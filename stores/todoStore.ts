import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Todo,
  CreateTodoInput,
  UpdateTodoInput,
  Priority,
} from "../types/todo";

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
}

export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
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

        set((state) => ({
          todos: [newTodo, ...state.todos], // Add to beginning for recency
        }));
      },

      updateTodo: (input: UpdateTodoInput) => {
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === input.id
              ? {
                  ...todo,
                  ...input,
                  updated_at: new Date().toISOString(),
                }
              : todo,
          ),
        }));
      },

      deleteTodo: (id: number) => {
        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
        }));
      },

      toggleTodo: (id: number) => {
        set((state) => ({
          todos: state.todos.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  completed: !todo.completed,
                  updated_at: new Date().toISOString(),
                }
              : todo,
          ),
        }));
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
      },
    }),
    {
      name: "voice-agent-todos", // localStorage key
      version: 1, // For migrations if needed later
    },
  ),
);

// Helper hook for common computed values
export const useTodoStats = () => {
  return useTodoStore((state) => {
    const total = state.todos.length;
    const completed = state.todos.filter((t) => t.completed).length;
    const pending = total - completed;
    const highPriority = state.todos.filter(
      (t) => t.priority === 3 && !t.completed,
    ).length;

    return {
      total,
      completed,
      pending,
      highPriority,
    };
  });
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
