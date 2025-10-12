export interface Todo {
  priority: number;
  title: string;
  description?: string;
  status: TodoStatus;
  due_date?: string; // ISO date string
  created_at: string;
  updated_at: string;
}

export type TodoStatus = "active" | "completed" | "archived";

export interface TodoIdentifier {
  priority: number;
  status: TodoStatus;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  due_date?: string;
  priority: number; // Required - specifies the exact position/priority of the todo
}

export interface UpdateTodoInput {
  priority: number; // Which todo priority to update
  status: TodoStatus; // Which todo status to update (composite key)
  newPriority?: number; // Optional new priority to move the todo to
  title?: string;
  description?: string;
  newStatus?: TodoStatus; // Optional new status to change the todo to
  due_date?: string;
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
