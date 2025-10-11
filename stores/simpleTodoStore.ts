import { create } from "zustand";
import {
  Todo,
  CreateTodoInput,
  UpdateTodoInput,
  Priority,
} from "../types/todo";

// Simple localStorage persistence without the persist middleware
const STORAGE_KEY = "voice-agent-todos";

const saveToStorage = (todos: Todo[]) => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    }
  } catch (error) {
    console.warn("Failed to save todos to localStorage:", error);
  }
};

const loadFromStorage = (): Todo[] => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (error) {
    console.warn("Failed to load todos from localStorage:", error);
  }
  return [];
};

interface TodoStore {
  todos: Todo[];

  // Actions
  addTodo: (input: CreateTodoInput) => void;
  updateTodo: (input: UpdateTodoInput) => void;
  deleteTodo: (id: number) => void;
  toggleTodo: (id: number) => void;

  // Computed getters
  getTodoById: (id: number) => Todo | undefined;
  getIncompleteTodos: () => Todo[];
  getCompletedTodos: () => Todo[];
  getTodosByPriority: (priority: Priority) => Todo[];

  // Utility
  clearAllTodos: () => void;
  loadTodos: () => void;
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],

  // Actions
  addTodo: (input: CreateTodoInput) => {
    const now = new Date().toISOString();
    const newTodo: Todo = {
      id: Date.now(), // Simple ID generation
      title: input.title,
      description: input.description,
      completed: false,
      priority: input.priority || 1,
      category: input.category,
      due_date: input.due_date,
      created_at: now,
      updated_at: now,
    };

    set((state) => {
      const newTodos = [newTodo, ...state.todos];
      saveToStorage(newTodos);
      return { todos: newTodos };
    });
  },

  updateTodo: (input: UpdateTodoInput) => {
    set((state) => {
      const newTodos = state.todos.map((todo) =>
        todo.id === input.id
          ? {
              ...todo,
              ...input,
              updated_at: new Date().toISOString(),
            }
          : todo,
      );
      saveToStorage(newTodos);
      return { todos: newTodos };
    });
  },

  deleteTodo: (id: number) => {
    set((state) => {
      const newTodos = state.todos.filter((todo) => todo.id !== id);
      saveToStorage(newTodos);
      return { todos: newTodos };
    });
  },

  toggleTodo: (id: number) => {
    set((state) => {
      const newTodos = state.todos.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              completed: !todo.completed,
              updated_at: new Date().toISOString(),
            }
          : todo,
      );
      saveToStorage(newTodos);
      return { todos: newTodos };
    });
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
  clearAllTodos: () => {
    set({ todos: [] });
    saveToStorage([]);
  },

  loadTodos: () => {
    const currentTodos = get().todos;
    const storedTodos = loadFromStorage();

    // Only update if todos actually changed
    if (JSON.stringify(currentTodos) !== JSON.stringify(storedTodos)) {
      set({ todos: storedTodos });
    }
  },
}));

// Memoized selector for todo stats to prevent infinite loops
let lastTodos: Todo[] | undefined;
let lastStats:
  | { total: number; completed: number; pending: number; highPriority: number }
  | undefined;

const selectTodoStats = (state: { todos: Todo[] }) => {
  // Only recalculate if todos array changed
  if (state.todos === lastTodos && lastStats) {
    return lastStats;
  }

  // Check if todos content actually changed (not just reference)
  const todosChanged =
    !lastTodos ||
    lastTodos.length !== state.todos.length ||
    lastTodos.some(
      (todo, i) =>
        state.todos[i]?.id !== todo.id ||
        state.todos[i]?.completed !== todo.completed ||
        state.todos[i]?.priority !== todo.priority,
    );

  if (!todosChanged && lastStats) {
    lastTodos = state.todos; // Update reference but keep stats
    return lastStats;
  }

  // Recalculate stats
  const total = state.todos.length;
  const completed = state.todos.filter((t) => t.completed).length;
  const pending = total - completed;
  const highPriority = state.todos.filter(
    (t) => t.priority === 3 && !t.completed,
  ).length;

  const stats = {
    total,
    completed,
    pending,
    highPriority,
  };

  lastTodos = state.todos;
  lastStats = stats;

  return stats;
};

// Helper hook for common computed values
export const useTodoStats = () => {
  return useTodoStore(selectTodoStats);
};

// Helper functions for voice commands
export const todoVoiceHelpers = {
  findTodoByPartialTitle: (partialTitle: string): Todo | undefined => {
    const { todos } = useTodoStore.getState();
    const lowerPartial = partialTitle.toLowerCase();

    return todos.find((todo) =>
      todo.title.toLowerCase().includes(lowerPartial),
    );
  },

  getFirstIncompleteTodo: (): Todo | undefined => {
    const { getIncompleteTodos } = useTodoStore.getState();
    const incompleteTodos = getIncompleteTodos();
    return incompleteTodos[0];
  },

  addTodoFromVoice: (text: string, priority: Priority = 1): void => {
    const { addTodo } = useTodoStore.getState();
    addTodo({
      title: text,
      priority,
    });
  },

  completeTodoByTitle: (partialTitle: string): boolean => {
    const todo = todoVoiceHelpers.findTodoByPartialTitle(partialTitle);
    if (todo && !todo.completed) {
      const { updateTodo } = useTodoStore.getState();
      updateTodo({ id: todo.id, completed: true });
      return true;
    }
    return false;
  },

  deleteTodoByTitle: (partialTitle: string): boolean => {
    const todo = todoVoiceHelpers.findTodoByPartialTitle(partialTitle);
    if (todo) {
      const { deleteTodo } = useTodoStore.getState();
      deleteTodo(todo.id);
      return true;
    }
    return false;
  },

  getTodoSummary: (): string => {
    const { todos } = useTodoStore.getState();
    const completed = todos.filter((t) => t.completed).length;
    const pending = todos.filter((t) => !t.completed).length;

    if (todos.length === 0) {
      return "Your todo list is empty.";
    }

    let summary = `You have ${pending} pending todos`;
    if (completed > 0) {
      summary += ` and ${completed} completed`;
    }

    if (pending > 0) {
      const recentPending = todos.filter((t) => !t.completed).slice(0, 3);
      summary +=
        ". Recent items: " + recentPending.map((t) => t.title).join(", ");
    }

    return summary + ".";
  },
};
