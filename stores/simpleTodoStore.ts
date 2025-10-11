import { create } from "zustand";
import { initializeDatabase } from "../db/database";
import { TodoService } from "../services/todoService";
import type {
  CreateTodoInput,
  Priority,
  Todo,
  UpdateTodoInput,
} from "../types/todo";

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
      await initializeDatabase();
      await get().loadTodos();
    } catch (error) {
      set({ error: `Database initialization failed: ${error}` });
    } finally {
      set({ isLoading: false });
    }
  },

  // Actions
  addTodo: async (input: CreateTodoInput) => {
    try {
      set({ isLoading: true, error: null });
      const newTodo = await TodoService.createTodo(input);
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
      const updatedTodo = await TodoService.updateTodo(input);
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
      const success = await TodoService.deleteTodo(id);
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
      const updatedTodo = await TodoService.toggleTodo(id);
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
      await TodoService.clearAllTodos();
      set({ todos: [], isLoading: false });
    } catch (error) {
      set({ error: `Failed to clear todos: ${error}`, isLoading: false });
    }
  },

  loadTodos: async () => {
    try {
      set({ isLoading: true, error: null });
      const todos = await TodoService.getAllTodos();
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
