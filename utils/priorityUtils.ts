import type { Todo } from "../types/todo";

/**
 * Bumps the priority of todos in-place starting from the given priority.
 * All todos with priority >= fromPriority will have their priority incremented by 1.
 * This is for in-memory array operations (used by test utils).
 *
 * @param todos - Array of todos to modify in-place
 * @param fromPriority - Starting priority to bump from
 * @param updatedAt - Timestamp to set for updated todos
 */
export function bumpTodosFromPriorityInMemory(
  todos: Todo[],
  fromPriority: number,
  updatedAt: string
): void {
  todos.forEach((todo) => {
    if (todo.priority >= fromPriority) {
      todo.priority += 1;
      todo.updated_at = updatedAt;
    }
  });
}

/**
 * Calculates the next available priority for a new todo.
 * Returns the highest priority (lowest number) available.
 *
 * @param todos - Array of existing todos
 * @returns Next available priority (defaults to 1 if no todos exist)
 */
export function getNextHighestPriority(todos: Todo[]): number {
  if (todos.length === 0) return 1;
  return Math.min(...todos.map((t) => t.priority)) - 1;
}
