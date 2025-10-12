export interface BaseTodo {
  id: number;
  title: string;
  description?: string;
  due_date?: string; // ISO date string
  created_at: string;
  updated_at: string;
}

export interface Todo extends BaseTodo {
  priority: number; // All todos maintain their priority regardless of status
  status: TodoStatus;
}

export type TodoStatus = "active" | "completed" | "archived";

export interface TodoIdentifier {
  id: number;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  due_date?: string;
  priority: number; // Required - specifies the exact priority position
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  due_date?: string;
  status?: TodoStatus;
  priority?: number; // Optional - if provided, bumps conflicting todos
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
