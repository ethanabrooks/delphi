export interface Todo {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  category?: string;
  due_date?: string; // ISO date string
  created_at: string;
  updated_at: string;
}

export type Priority = 1 | 2 | 3; // 1: low, 2: medium, 3: high

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: Priority;
  category?: string;
  due_date?: string;
}

export interface UpdateTodoInput {
  id: number;
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: Priority;
  category?: string;
  due_date?: string;
}

export const PRIORITY_LABELS = {
  1: "Low",
  2: "Medium",
  3: "High",
} as const;

export const PRIORITY_COLORS = {
  1: "bg-green-100 text-green-800",
  2: "bg-yellow-100 text-yellow-800",
  3: "bg-red-100 text-red-800",
} as const;
