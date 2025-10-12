export interface BaseTodo {
  id: number;
  title: string;
  description?: string;
  due_date?: string; // ISO date string
  created_at: string;
  updated_at: string;
}

export interface ActiveTodo extends BaseTodo {
  priority: number; // Required for active todos
  status: "active";
}

export interface NonActiveTodo extends BaseTodo {
  priority: null; // Always null for non-active todos
  status: "completed" | "archived";
}

export type Todo = ActiveTodo | NonActiveTodo;

export type TodoStatus = "active" | "completed" | "archived";

export interface TodoIdentifier {
  id: number;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  due_date?: string;
  // Priority is auto-assigned for new active todos
}

export const STATUS_LABELS = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
} as const;

export const STATUS_COLORS = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-800",
} as const;
