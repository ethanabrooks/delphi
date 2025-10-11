import type { CreateTodoInput, Todo, UpdateTodoInput } from "../types/todo";
import { TodoService } from "./todoService";

const isJestEnv =
  typeof globalThis !== "undefined" &&
  Boolean((globalThis as { jest?: unknown }).jest);
export const isWebPlatform =
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  !isJestEnv;

const STORAGE_KEY = "delphi_todos";

// biome-ignore lint/complexity/noStaticOnlyClass: platform abstraction is a static shim over localStorage
class WebTodoService {
  private static read(): Todo[] {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Todo[]) : [];
    } catch {
      return [];
    }
  }

  private static write(todos: Todo[]): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // ignore persistence errors in web demo mode
    }
  }

  static async getAllTodos(): Promise<Todo[]> {
    return WebTodoService.read();
  }

  static async createTodo(input: CreateTodoInput): Promise<Todo> {
    const todos = WebTodoService.read();
    const now = new Date().toISOString();
    const newTodo: Todo = {
      id: Date.now(),
      title: input.title,
      description: input.description,
      completed: false,
      priority: input.priority ?? 1,
      category: input.category,
      due_date: input.due_date,
      created_at: now,
      updated_at: now,
    };

    WebTodoService.write([newTodo, ...todos]);
    return newTodo;
  }

  static async updateTodo(input: UpdateTodoInput): Promise<Todo | null> {
    const todos = WebTodoService.read();
    const index = todos.findIndex((todo) => todo.id === input.id);

    if (index === -1) {
      return null;
    }

    const updated: Todo = {
      ...todos[index],
      ...input,
      updated_at: new Date().toISOString(),
    };

    todos[index] = updated;
    WebTodoService.write(todos);
    return updated;
  }

  static async deleteTodo(id: number): Promise<boolean> {
    const todos = WebTodoService.read();
    const filtered = todos.filter((todo) => todo.id !== id);
    WebTodoService.write(filtered);
    return filtered.length !== todos.length;
  }

  static async toggleTodo(id: number): Promise<Todo | null> {
    const todos = WebTodoService.read();
    const todo = todos.find((item) => item.id === id);

    if (!todo) {
      return null;
    }

    return WebTodoService.updateTodo({ id, completed: !todo.completed });
  }

  static async clearAllTodos(): Promise<void> {
    WebTodoService.write([]);
  }
}

export const platformTodoService = isWebPlatform ? WebTodoService : TodoService;
export type PlatformTodoService = typeof platformTodoService;
