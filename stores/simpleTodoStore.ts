import { create } from "zustand";
import { initializeDatabase } from "../db/database";
import { TodoService } from "../services/todoService";
import type {
  CreateTodoInput,
  Priority,
  Todo,
  UpdateTodoInput,
} from "../types/todo";

// Web fallback using localStorage
// Detect web environment but exclude test environments
const isWeb = typeof window !== "undefined" && typeof jest === "undefined";
const STORAGE_KEY = "delphi_todos";

class WebTodoService {
  private static getTodos(): Todo[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private static saveTodos(todos: Todo[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // Ignore storage errors
    }
  }

  static async getAllTodos(): Promise<Todo[]> {
    return WebTodoService.getTodos();
  }

  static async createTodo(input: CreateTodoInput): Promise<Todo> {
    const todos = WebTodoService.getTodos();
    const newTodo: Todo = {
      id: Date.now(), // Simple ID generation for web
      title: input.title,
      description: input.description,
      completed: false,
      priority: input.priority || 1,
      category: input.category,
      due_date: input.due_date,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedTodos = [newTodo, ...todos];
    WebTodoService.saveTodos(updatedTodos);
    return newTodo;
  }

  static async updateTodo(input: UpdateTodoInput): Promise<Todo | null> {
    const todos = WebTodoService.getTodos();
    const index = todos.findIndex((t) => t.id === input.id);
    if (index === -1) return null;

    const updatedTodo = {
      ...todos[index],
      ...input,
      updated_at: new Date().toISOString(),
    };
    todos[index] = updatedTodo;
    WebTodoService.saveTodos(todos);
    return updatedTodo;
  }

  static async deleteTodo(id: number): Promise<boolean> {
    const todos = WebTodoService.getTodos();
    const filtered = todos.filter((t) => t.id !== id);
    WebTodoService.saveTodos(filtered);
    return filtered.length < todos.length;
  }

  static async toggleTodo(id: number): Promise<Todo | null> {
    const todos = WebTodoService.getTodos();
    const todo = todos.find((t) => t.id === id);
    if (!todo) return null;

    return WebTodoService.updateTodo({ id, completed: !todo.completed });
  }

  static async clearAllTodos(): Promise<void> {
    WebTodoService.saveTodos([]);
  }
}

// Platform-aware service selector
const todoService = isWeb ? WebTodoService : TodoService;

interface TodoStore {
  todos: Todo[];
  isLoading: boolean;
  error: string | null;

  // Actions
  addTodo: (input: CreateTodoInput) => Promise<void>;
  updateTodo: (input: UpdateTodoInput) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  toggleTodo: (id: number) => Promise<void>;

  // Computed getters
  getTodoById: (id: number) => Todo | undefined;
  getIncompleteTodos: () => Todo[];
  getCompletedTodos: () => Todo[];
  getTodosByPriority: (priority: Priority) => Todo[];

  // Utility
  clearAllTodos: () => Promise<void>;
  loadTodos: () => Promise<void>;
  initializeDb: () => Promise<void>;
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],
  isLoading: false,
  error: null,

  // Initialize database
  initializeDb: async () => {
    try {
      set({ isLoading: true, error: null });
      if (!isWeb) {
        await initializeDatabase();
      }
      await get().loadTodos();
    } catch (error) {
      set({
        error: `Database initialization failed: ${error}`,
        isLoading: false,
      });
    }
  },

  // Actions
  addTodo: async (input: CreateTodoInput) => {
    try {
      set({ isLoading: true, error: null });
      const newTodo = await todoService.createTodo(input);
      set((state) => ({
        todos: [newTodo, ...state.todos],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: `Failed to add todo: ${error}`, isLoading: false });
    }
  },

  updateTodo: async (input: UpdateTodoInput) => {
    try {
      set({ isLoading: true, error: null });
      const updatedTodo = await todoService.updateTodo(input);
      if (updatedTodo) {
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === input.id ? updatedTodo : todo
          ),
          isLoading: false,
        }));
      }
    } catch (error) {
      set({ error: `Failed to update todo: ${error}`, isLoading: false });
    }
  },

  deleteTodo: async (id: number) => {
    try {
      set({ isLoading: true, error: null });
      const success = await todoService.deleteTodo(id);
      if (success) {
        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
          isLoading: false,
        }));
      }
    } catch (error) {
      set({ error: `Failed to delete todo: ${error}`, isLoading: false });
    }
  },

  toggleTodo: async (id: number) => {
    try {
      set({ isLoading: true, error: null });
      const updatedTodo = await todoService.toggleTodo(id);
      if (updatedTodo) {
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id ? updatedTodo : todo
          ),
          isLoading: false,
        }));
      }
    } catch (error) {
      set({ error: `Failed to toggle todo: ${error}`, isLoading: false });
    }
  },

  // Computed getters
  getTodoById: (id: number) => {
    return get().todos.find((todo) => todo.id === id);
  },

  getIncompleteTodos: () => {
    return get().todos.filter((todo) => !todo.completed);
  },

  getCompletedTodos: () => {
    return get().todos.filter((todo) => todo.completed);
  },

  getTodosByPriority: (priority: Priority) => {
    return get().todos.filter((todo) => todo.priority === priority);
  },

  // Utility
  clearAllTodos: async () => {
    try {
      set({ isLoading: true, error: null });
      await todoService.clearAllTodos();
      set({ todos: [], isLoading: false });
    } catch (error) {
      set({ error: `Failed to clear todos: ${error}`, isLoading: false });
    }
  },

  loadTodos: async () => {
    try {
      set({ isLoading: true, error: null });
      const todos = await todoService.getAllTodos();
      set({ todos, isLoading: false });
    } catch (error) {
      set({ error: `Failed to load todos: ${error}`, isLoading: false });
    }
  },
}));

// Helper hook for stats using the service
export const useTodoStats = () => {
  const todos = useTodoStore((state) => state.todos);

  // Calculate stats from current todos in store
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const pending = total - completed;
  const highPriority = todos.filter(
    (t) => t.priority === 3 && !t.completed
  ).length;

  return { total, completed, pending, highPriority };
};
