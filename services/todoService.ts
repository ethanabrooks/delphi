import { asc, eq, gte } from "drizzle-orm";
import { db, mapTodoRowToTodo } from "../db/database";
import { todos } from "../db/schema";
import type {
  CreateTodoInput,
  Todo,
  TodoStatus,
  UpdateTodoInput,
} from "../types/todo";
import { getNextHighestPriority } from "../utils/priorityUtils";

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

  static async getTodoByPriority(priority: number): Promise<Todo | null> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.priority, priority))
      .limit(1);

    return rows.length > 0 ? mapTodoRowToTodo(rows[0]) : null;
  }

  private static async bumpTodosFromPriority(
    fromPriority: number
  ): Promise<void> {
    const database = await db();

    // Get all todos with priority >= fromPriority, ordered by priority
    const todosToUpdate = await database
      .select()
      .from(todos)
      .where(gte(todos.priority, fromPriority))
      .orderBy(asc(todos.priority));

    // Update each todo's priority by incrementing it by 1
    for (const todo of todosToUpdate) {
      await database
        .update(todos)
        .set({
          priority: todo.priority + 1,
          updated_at: new Date().toISOString(),
        })
        .where(eq(todos.priority, todo.priority));
    }
  }

  static async createTodo(input: CreateTodoInput): Promise<Todo> {
    const database = await db();
    const now = new Date().toISOString();

    let targetPriority: number;

    if (input.priority !== undefined) {
      targetPriority = input.priority;
      // Check if priority already exists and bump if needed
      await TodoService.bumpTodosFromPriority(targetPriority);
    } else {
      // Assign highest priority (lowest number)
      const allTodos = await TodoService.getAllTodos();
      targetPriority = getNextHighestPriority(allTodos);
    }

    const [result] = await database
      .insert(todos)
      .values({
        priority: targetPriority,
        title: input.title,
        description: input.description,
        status: "active",
        due_date: input.due_date,
        created_at: now,
        updated_at: now,
      })
      .returning();

    return mapTodoRowToTodo(result);
  }

  static async updateTodo(input: UpdateTodoInput): Promise<Todo | null> {
    const database = await db();
    const now = new Date().toISOString();

    // First, get the current todo to check if it exists
    const currentTodo = await TodoService.getTodoByPriority(input.priority);
    if (!currentTodo) return null;

    // Check if we're changing the priority
    if (
      input.newPriority !== undefined &&
      input.newPriority !== input.priority
    ) {
      // We're changing priority - handle bumping
      await TodoService.bumpTodosFromPriority(input.newPriority);

      // Update the todo with new priority and other fields
      const [result] = await database
        .update(todos)
        .set({
          priority: input.newPriority,
          title: input.title ?? currentTodo.title,
          description: input.description ?? currentTodo.description,
          status: input.status ?? currentTodo.status,
          due_date: input.due_date ?? currentTodo.due_date,
          updated_at: now,
        })
        .where(eq(todos.priority, input.priority))
        .returning();

      return result ? mapTodoRowToTodo(result) : null;
    } else {
      // Not changing priority - just update other fields
      const [result] = await database
        .update(todos)
        .set({
          title: input.title ?? currentTodo.title,
          description: input.description ?? currentTodo.description,
          status: input.status ?? currentTodo.status,
          due_date: input.due_date ?? currentTodo.due_date,
          updated_at: now,
        })
        .where(eq(todos.priority, input.priority))
        .returning();

      return result ? mapTodoRowToTodo(result) : null;
    }
  }

  static async deleteTodo(priority: number): Promise<boolean> {
    const database = await db();
    const result = await database
      .delete(todos)
      .where(eq(todos.priority, priority));

    return result.changes > 0;
  }

  static async toggleTodo(priority: number): Promise<Todo | null> {
    // First get the current state
    const current = await TodoService.getTodoByPriority(priority);
    if (!current) return null;

    // Toggle between active and completed
    const newStatus: TodoStatus =
      current.status === "completed" ? "active" : "completed";
    return TodoService.updateTodo({
      priority,
      status: newStatus,
    });
  }

  static async getActiveTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, "active"))
      .orderBy(asc(todos.priority));

    return rows.map(mapTodoRowToTodo);
  }

  static async getCompletedTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, "completed"))
      .orderBy(asc(todos.priority));

    return rows.map(mapTodoRowToTodo);
  }

  static async getArchivedTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, "archived"))
      .orderBy(asc(todos.priority));

    return rows.map(mapTodoRowToTodo);
  }

  static async getTodosByStatus(status: TodoStatus): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, status))
      .orderBy(asc(todos.priority));

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
