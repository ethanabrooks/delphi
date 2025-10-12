import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db, mapTodoRowToTodo } from "../db/database";
import { todos } from "../db/schema";
import type {
  CreateTodoInput,
  Todo,
  TodoStatus,
  UpdateTodoInput,
} from "../types/todo";

// biome-ignore lint/complexity/noStaticOnlyClass: service methods map directly to SQL helpers
export class TodoService {
  static async getAllTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .orderBy(asc(todos.priority));

    return rows.map(mapTodoRowToTodo);
  }

  static async getTodoById(id: number): Promise<Todo | null> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.id, id))
      .limit(1);

    return rows.length > 0 ? mapTodoRowToTodo(rows[0]) : null;
  }

  private static async bumpTodosFromPriority(
    conflictPriority: number,
    maxDepth: number = 100
  ): Promise<void> {
    const database = await db();

    // Early exit if conflictPriority is invalid
    if (conflictPriority < 1) {
      throw new Error("Priority must be >= 1");
    }

    // Safeguard against infinite recursion
    if (maxDepth <= 0) {
      throw new Error(
        "Maximum recursion depth reached during priority bumping"
      );
    }

    // Find the specific todo that conflicts with the requested priority
    const conflictingTodo = await database
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.status, "active"),
          eq(todos.priority, conflictPriority),
          isNotNull(todos.priority)
        )
      )
      .limit(1);

    // No conflict - we're done
    if (conflictingTodo.length === 0) {
      return;
    }

    const todo = conflictingTodo[0];
    const newPriority = conflictPriority + 1;
    const now = new Date().toISOString();

    // Recursively bump any todo that would conflict with our new position
    await TodoService.bumpTodosFromPriority(newPriority, maxDepth - 1);

    // Now it's safe to bump this todo to the next position
    await database
      .update(todos)
      .set({
        priority: newPriority,
        updated_at: now,
      })
      .where(eq(todos.id, todo.id));
  }

  private static async closeGapAtPriority(gapPriority: number): Promise<void> {
    const database = await db();

    // Close the gap by decrementing all priorities > gapPriority by 1
    // This maintains dense ordering (no gaps) in a single SQL statement
    await database
      .update(todos)
      .set({
        priority: sql`priority - 1`,
        updated_at: new Date().toISOString(),
      })
      .where(
        and(
          eq(todos.status, "active"),
          gt(todos.priority, gapPriority),
          isNotNull(todos.priority)
        )
      );
  }

  static async createTodo(input: CreateTodoInput): Promise<Todo> {
    const database = await db();
    const now = new Date().toISOString();

    const result = await database.transaction(async (tx) => {
      // Bump any existing todos at or above the requested priority
      await TodoService.bumpTodosFromPriority(input.priority);

      // Insert the new todo at the requested priority
      const [insertResult] = await tx
        .insert(todos)
        .values({
          priority: input.priority,
          title: input.title,
          description: input.description,
          status: "active",
          due_date: input.due_date,
          created_at: now,
          updated_at: now,
        })
        .returning();

      return mapTodoRowToTodo(insertResult);
    });

    return result;
  }

  static async updateTodo(
    id: number,
    updates: UpdateTodoInput
  ): Promise<Todo | null> {
    const database = await db();
    const now = new Date().toISOString();

    // Get the current todo
    const currentTodo = await TodoService.getTodoById(id);
    if (!currentTodo) return null;

    let result: Todo | null = null;

    await database.transaction(async (tx) => {
      // Handle priority changes first (if provided)
      if (updates.priority !== undefined && currentTodo.status === "active") {
        // Only handle priority for active todos
        if (updates.priority !== currentTodo.priority) {
          // Close gap from old position if needed
          if (currentTodo.priority !== null) {
            await TodoService.closeGapAtPriority(currentTodo.priority);
          }
          // Bump todos at new position
          await TodoService.bumpTodosFromPriority(updates.priority);
        }
      }

      // Handle status changes
      let newPriority: number | null = currentTodo.priority;

      if (updates.status && updates.status !== currentTodo.status) {
        if (currentTodo.status === "active" && updates.status !== "active") {
          // Moving out of active - clear priority and close gap
          if (currentTodo.priority !== null) {
            await TodoService.closeGapAtPriority(currentTodo.priority);
          }
          newPriority = null;
        } else if (
          currentTodo.status !== "active" &&
          updates.status === "active"
        ) {
          // Moving into active - require explicit priority
          if (updates.priority === undefined) {
            throw new Error(
              "Priority is required when changing status to active"
            );
          }
          await TodoService.bumpTodosFromPriority(updates.priority);
          newPriority = updates.priority;
        }
      } else if (
        updates.priority !== undefined &&
        currentTodo.status === "active"
      ) {
        // Priority change within active status
        newPriority = updates.priority;
      }

      // Apply all updates
      const [updated] = await tx
        .update(todos)
        .set({
          priority: newPriority,
          status: updates.status ?? currentTodo.status,
          title: updates.title ?? currentTodo.title,
          description: updates.description ?? currentTodo.description,
          due_date: updates.due_date ?? currentTodo.due_date,
          updated_at: now,
        })
        .where(eq(todos.id, id))
        .returning();

      result = mapTodoRowToTodo(updated);
    });

    return result;
  }

  // Repair tool: Resequence active priorities to ensure dense ordering (1,2,3,4...)
  // Only call this for recovery after crashes or manual database edits
  // Normal operations maintain dense ordering automatically
  static async resequenceActivePriorities(): Promise<{
    resequenced: boolean;
    gaps: number;
  }> {
    const database = await db();

    return await database.transaction(async (tx) => {
      // Get all active todos ordered by current priority
      const activeTodos = await tx
        .select()
        .from(todos)
        .where(and(eq(todos.status, "active"), isNotNull(todos.priority)))
        .orderBy(asc(todos.priority));

      if (activeTodos.length === 0) {
        return { resequenced: false, gaps: 0 };
      }

      // Check if compacting is needed by looking for gaps
      let gaps = 0;
      const needsCompacting = activeTodos.some((todo, index) => {
        const expectedPriority = index + 1;
        if (todo.priority !== expectedPriority) {
          gaps++;
          return true;
        }
        return false;
      });

      if (!needsCompacting) {
        return { resequenced: false, gaps: 0 };
      }

      // Reassign priorities to create dense sequence (1,2,3,4...)
      const now = new Date().toISOString();

      for (let i = 0; i < activeTodos.length; i++) {
        const todo = activeTodos[i];
        const newPriority = i + 1;

        if (todo.priority !== newPriority) {
          await tx
            .update(todos)
            .set({
              priority: newPriority,
              updated_at: now,
            })
            .where(eq(todos.id, todo.id));
        }
      }

      return { resequenced: true, gaps };
    });
  }

  static async deleteTodo(id: number): Promise<boolean> {
    const database = await db();

    let success = false;

    await database.transaction(async (tx) => {
      // Get the todo first to check if we need to reindex
      const todo = await TodoService.getTodoById(id);
      if (!todo) return;

      // Delete the todo
      const result = await tx.delete(todos).where(eq(todos.id, id));

      // If it was an active todo, close the gap immediately
      if (todo.status === "active" && todo.priority !== null) {
        await TodoService.closeGapAtPriority(todo.priority);
      }

      success = result.changes > 0;
    });

    return success;
  }

  static async toggleTodo(
    id: number,
    priorityIfActivating?: number
  ): Promise<Todo | null> {
    // First get the current state
    const current = await TodoService.getTodoById(id);
    if (!current) return null;

    if (current.status === "active") {
      // Deactivating - toggle to completed
      return TodoService.updateTodo(id, { status: "completed" });
    } else if (current.status === "completed") {
      // Activating - require explicit priority
      if (priorityIfActivating === undefined) {
        throw new Error(
          "Priority is required when toggling a todo to active status"
        );
      }
      return TodoService.updateTodo(id, {
        status: "active",
        priority: priorityIfActivating,
      });
    } else {
      // From archived - not supported in toggle, use updateTodo directly
      throw new Error(
        "Cannot toggle archived todos. Use updateTodo to change status explicitly."
      );
    }
  }

  static async getActiveTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, "active"))
      .orderBy(asc(todos.priority), asc(todos.id));

    return rows.map(mapTodoRowToTodo);
  }

  static async getCompletedTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, "completed"))
      .orderBy(asc(todos.id)); // Non-active todos ordered by creation (id)

    return rows.map(mapTodoRowToTodo);
  }

  static async getArchivedTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, "archived"))
      .orderBy(asc(todos.id)); // Non-active todos ordered by creation (id)

    return rows.map(mapTodoRowToTodo);
  }

  static async getTodosByStatus(status: TodoStatus): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, status))
      .orderBy(
        status === "active" ? asc(todos.priority) : asc(todos.id) // Active todos by priority, others by creation order
      );

    return rows.map(mapTodoRowToTodo);
  }

  static async clearAllTodos(): Promise<void> {
    const database = await db();
    await database.delete(todos);
  }

  static async getTodoStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    archived: number;
  }> {
    const allTodos = await TodoService.getAllTodos();

    const total = allTodos.length;
    const active = allTodos.filter((t) => t.status === "active").length;
    const completed = allTodos.filter((t) => t.status === "completed").length;
    const archived = allTodos.filter((t) => t.status === "archived").length;

    return { total, active, completed, archived };
  }
}
