import { desc, eq } from "drizzle-orm";
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
      .orderBy(desc(todos.created_at));

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

  static async createTodo(input: CreateTodoInput): Promise<Todo> {
    const database = await db();
    const now = new Date().toISOString();

    const [result] = await database
      .insert(todos)
      .values({
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

    const [result] = await database
      .update(todos)
      .set({
        ...input,
        updated_at: now,
      })
      .where(eq(todos.id, input.id))
      .returning();

    return result ? mapTodoRowToTodo(result) : null;
  }

  static async deleteTodo(id: number): Promise<boolean> {
    const database = await db();
    const result = await database.delete(todos).where(eq(todos.id, id));

    return result.changes > 0;
  }

  static async toggleTodo(id: number): Promise<Todo | null> {
    // First get the current state
    const current = await TodoService.getTodoById(id);
    if (!current) return null;

    // Toggle between active and completed
    const newStatus: TodoStatus =
      current.status === "completed" ? "active" : "completed";
    return TodoService.updateTodo({
      id,
      status: newStatus,
    });
  }

  static async getActiveTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, "active"))
      .orderBy(desc(todos.created_at));

    return rows.map(mapTodoRowToTodo);
  }

  static async getCompletedTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, "completed"))
      .orderBy(desc(todos.created_at));

    return rows.map(mapTodoRowToTodo);
  }

  static async getArchivedTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, "archived"))
      .orderBy(desc(todos.created_at));

    return rows.map(mapTodoRowToTodo);
  }

  static async getTodosByStatus(status: TodoStatus): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.status, status))
      .orderBy(desc(todos.created_at));

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
