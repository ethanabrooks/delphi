import { and, asc, desc, eq, gt, isNotNull } from "drizzle-orm";
import { db, mapTodoRowToTodo } from "../db/database";
import { todos } from "../db/schema";
import type { CreateTodoInput, Todo, TodoStatus } from "../types/todo";

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

  private static async getNextActivePriority(): Promise<number> {
    const database = await db();
    // Get the highest priority from active todos
    const result = await database
      .select({ maxPriority: todos.priority })
      .from(todos)
      .where(and(eq(todos.status, "active"), isNotNull(todos.priority)))
      .orderBy(desc(todos.priority))
      .limit(1);

    return result.length > 0 && result[0].maxPriority !== null
      ? result[0].maxPriority + 1
      : 1;
  }

  private static async shiftDownFromPriority(
    fromPriority: number
  ): Promise<void> {
    const database = await db();

    // Get all active todos with priority > fromPriority
    const todosToShift = await database
      .select()
      .from(todos)
      .where(and(eq(todos.status, "active"), gt(todos.priority, fromPriority)))
      .orderBy(asc(todos.priority));

    // Decrement each priority by 1
    for (const todo of todosToShift) {
      if (todo.priority !== null) {
        await database
          .update(todos)
          .set({
            priority: todo.priority - 1,
            updated_at: new Date().toISOString(),
          })
          .where(eq(todos.id, todo.id));
      }
    }
  }

  static async createTodo(input: CreateTodoInput): Promise<Todo> {
    const database = await db();
    const now = new Date().toISOString();

    await database.transaction(async (tx) => {
      // For new todos, assign the next available priority in active status
      const nextPriority = await TodoService.getNextActivePriority();

      await tx.insert(todos).values({
        priority: nextPriority,
        title: input.title,
        description: input.description,
        status: "active",
        due_date: input.due_date,
        created_at: now,
        updated_at: now,
      });
    });

    // Fetch and return the created todo
    const result = await database
      .select()
      .from(todos)
      .where(and(eq(todos.title, input.title), eq(todos.created_at, now)))
      .limit(1);

    return mapTodoRowToTodo(result[0]);
  }

  static async updateTodo(
    id: number,
    updates: Partial<
      Pick<Todo, "title" | "description" | "due_date" | "status">
    >
  ): Promise<Todo | null> {
    const database = await db();
    const now = new Date().toISOString();

    // Get the current todo
    const currentTodo = await TodoService.getTodoById(id);
    if (!currentTodo) return null;

    let result: Todo | null = null;

    await database.transaction(async (tx) => {
      // Handle status change logic
      if (updates.status && updates.status !== currentTodo.status) {
        if (currentTodo.status === "active" && updates.status !== "active") {
          // Moving out of active status - clear priority and shift down
          if (currentTodo.priority !== null) {
            await TodoService.shiftDownFromPriority(currentTodo.priority);
          }

          const [updated] = await tx
            .update(todos)
            .set({
              priority: null, // Clear priority for non-active todos
              status: updates.status,
              title: updates.title ?? currentTodo.title,
              description: updates.description ?? currentTodo.description,
              due_date: updates.due_date ?? currentTodo.due_date,
              updated_at: now,
            })
            .where(eq(todos.id, id))
            .returning();

          result = mapTodoRowToTodo(updated);
        } else if (
          currentTodo.status !== "active" &&
          updates.status === "active"
        ) {
          // Moving into active status - assign new priority
          const nextPriority = await TodoService.getNextActivePriority();

          const [updated] = await tx
            .update(todos)
            .set({
              priority: nextPriority,
              status: updates.status,
              title: updates.title ?? currentTodo.title,
              description: updates.description ?? currentTodo.description,
              due_date: updates.due_date ?? currentTodo.due_date,
              updated_at: now,
            })
            .where(eq(todos.id, id))
            .returning();

          result = mapTodoRowToTodo(updated);
        } else {
          // Status change within non-active statuses
          const [updated] = await tx
            .update(todos)
            .set({
              status: updates.status,
              title: updates.title ?? currentTodo.title,
              description: updates.description ?? currentTodo.description,
              due_date: updates.due_date ?? currentTodo.due_date,
              updated_at: now,
            })
            .where(eq(todos.id, id))
            .returning();

          result = mapTodoRowToTodo(updated);
        }
      } else {
        // No status change - simple update
        const [updated] = await tx
          .update(todos)
          .set({
            title: updates.title ?? currentTodo.title,
            description: updates.description ?? currentTodo.description,
            due_date: updates.due_date ?? currentTodo.due_date,
            updated_at: now,
          })
          .where(eq(todos.id, id))
          .returning();

        result = mapTodoRowToTodo(updated);
      }
    });

    return result;
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

      // If it was an active todo, shift down priorities
      if (todo.status === "active" && todo.priority !== null) {
        await TodoService.shiftDownFromPriority(todo.priority);
      }

      success = result.changes > 0;
    });

    return success;
  }

  static async toggleTodo(id: number): Promise<Todo | null> {
    // First get the current state
    const current = await TodoService.getTodoById(id);
    if (!current) return null;

    // Toggle between active and completed
    const newStatus: TodoStatus =
      current.status === "completed" ? "active" : "completed";
    return TodoService.updateTodo(id, { status: newStatus });
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
