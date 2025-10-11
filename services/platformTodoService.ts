import type {
  CreateTodoInput,
  Priority,
  Todo,
  UpdateTodoInput,
} from "../types/todo";

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

  static async getTodoById(id: number): Promise<Todo | null> {
    const todos = WebTodoService.read();
    return todos.find((todo) => todo.id === id) || null;
  }

  static async getIncompleteTodos(): Promise<Todo[]> {
    const todos = WebTodoService.read();
    return todos.filter((todo) => !todo.completed);
  }

  static async getCompletedTodos(): Promise<Todo[]> {
    const todos = WebTodoService.read();
    return todos.filter((todo) => todo.completed);
  }

  static async getTodosByPriority(priority: Priority): Promise<Todo[]> {
    const todos = WebTodoService.read();
    return todos.filter((todo) => todo.priority === priority);
  }

  static async getTodoStats(): Promise<{
    total: number;
    completed: number;
    pending: number;
    highPriority: number;
  }> {
    const todos = WebTodoService.read();
    return {
      total: todos.length,
      completed: todos.filter((todo) => todo.completed).length,
      pending: todos.filter((todo) => !todo.completed).length,
      highPriority: todos.filter((todo) => todo.priority === 3).length,
    };
  }
}

// Lazy import TodoService only when not on web to avoid SQLite dependency
let nativeService: typeof import("./todoService").TodoService | null = null;

const getNativeService = async () => {
  if (!nativeService) {
    const { TodoService } = await import("./todoService");
    nativeService = TodoService;
  }
  return nativeService;
};

class PlatformTodoServiceWrapper {
  static async getAllTodos(): Promise<Todo[]> {
    if (isWebPlatform) {
      return WebTodoService.getAllTodos();
    }
    const service = await getNativeService();
    return service.getAllTodos();
  }

  static async createTodo(input: CreateTodoInput): Promise<Todo> {
    if (isWebPlatform) {
      return WebTodoService.createTodo(input);
    }
    const service = await getNativeService();
    return service.createTodo(input);
  }

  static async updateTodo(input: UpdateTodoInput): Promise<Todo | null> {
    if (isWebPlatform) {
      return WebTodoService.updateTodo(input);
    }
    const service = await getNativeService();
    return service.updateTodo(input);
  }

  static async deleteTodo(id: number): Promise<boolean> {
    if (isWebPlatform) {
      return WebTodoService.deleteTodo(id);
    }
    const service = await getNativeService();
    return service.deleteTodo(id);
  }

  static async toggleTodo(id: number): Promise<Todo | null> {
    if (isWebPlatform) {
      return WebTodoService.toggleTodo(id);
    }
    const service = await getNativeService();
    return service.toggleTodo(id);
  }

  static async clearAllTodos(): Promise<void> {
    if (isWebPlatform) {
      return WebTodoService.clearAllTodos();
    }
    const service = await getNativeService();
    return service.clearAllTodos();
  }

  static async getTodoById(id: number): Promise<Todo | null> {
    if (isWebPlatform) {
      return WebTodoService.getTodoById(id);
    }
    const service = await getNativeService();
    return service.getTodoById(id);
  }

  static async getIncompleteTodos(): Promise<Todo[]> {
    if (isWebPlatform) {
      return WebTodoService.getIncompleteTodos();
    }
    const service = await getNativeService();
    return service.getIncompleteTodos();
  }

  static async getCompletedTodos(): Promise<Todo[]> {
    if (isWebPlatform) {
      return WebTodoService.getCompletedTodos();
    }
    const service = await getNativeService();
    return service.getCompletedTodos();
  }

  static async getTodosByPriority(priority: Priority): Promise<Todo[]> {
    if (isWebPlatform) {
      return WebTodoService.getTodosByPriority(priority);
    }
    const service = await getNativeService();
    return service.getTodosByPriority(priority);
  }

  static async getTodoStats(): Promise<{
    total: number;
    completed: number;
    pending: number;
    highPriority: number;
  }> {
    if (isWebPlatform) {
      return WebTodoService.getTodoStats();
    }
    const service = await getNativeService();
    return service.getTodoStats();
  }
}

export const platformTodoService = PlatformTodoServiceWrapper;
export type PlatformTodoService = typeof platformTodoService;
