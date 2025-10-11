import { desc, eq } from "drizzle-orm";
import { db, mapTodoRowToTodo } from "../db/database";
import { todos } from "../db/schema";
import type {
  CreateTodoInput,
  Priority,
  Todo,
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
        completed: false,
        priority: input.priority || 1,
        category: input.category,
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

    // Toggle the completed state
    return TodoService.updateTodo({
      id,
      completed: !current.completed,
    });
  }

  static async getIncompleteTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.completed, false))
      .orderBy(desc(todos.created_at));

    return rows.map(mapTodoRowToTodo);
  }

  static async getCompletedTodos(): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.completed, true))
      .orderBy(desc(todos.created_at));

    return rows.map(mapTodoRowToTodo);
  }

  static async getTodosByPriority(priority: Priority): Promise<Todo[]> {
    const database = await db();
    const rows = await database
      .select()
      .from(todos)
      .where(eq(todos.priority, priority))
      .orderBy(desc(todos.created_at));

    return rows.map(mapTodoRowToTodo);
  }

  static async clearAllTodos(): Promise<void> {
    const database = await db();
    await database.delete(todos);
  }

  static async getTodoStats(): Promise<{
    total: number;
    completed: number;
    pending: number;
    highPriority: number;
  }> {
    const allTodos = await TodoService.getAllTodos();

    const total = allTodos.length;
    const completed = allTodos.filter((t) => t.completed).length;
    const pending = total - completed;
    const highPriority = allTodos.filter(
      (t) => t.priority === 3 && !t.completed
    ).length;

    return { total, completed, pending, highPriority };
  }
}
