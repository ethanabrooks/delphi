import type { Todo, TodoStatus } from "../types/todo";

/**
 * Bumps the priority of todos in-place starting from the given priority within a specific status.
 * All todos with priority >= fromPriority and matching status will have their priority incremented by 1.
 * This is for in-memory array operations (used by test utils).
 *
 * @param todos - Array of todos to modify in-place
 * @param fromPriority - Starting priority to bump from
 * @param withinStatus - Only bump todos with this status
 * @param updatedAt - Timestamp to set for updated todos
 */
export function bumpTodosFromPriorityInMemory(
  todos: Todo[],
  fromPriority: number,
  withinStatus: TodoStatus,
  updatedAt: string
): void {
  todos.forEach((todo) => {
    if (todo.priority >= fromPriority && todo.status === withinStatus) {
      todo.priority += 1;
      todo.updated_at = updatedAt;
    }
  });
}

/**
 * Calculates the next available priority for a new todo within a specific status.
 * Returns the highest priority (lowest number) available for that status.
 *
 * @param todos - Array of existing todos
 * @param status - Status to calculate priority for
 * @returns Next available priority (defaults to 1 if no todos exist for that status)
 */
export function getNextHighestPriority(
  todos: Todo[],
  status: TodoStatus
): number {
  const todosInStatus = todos.filter((t) => t.status === status);
  if (todosInStatus.length === 0) return 1;
  return Math.min(...todosInStatus.map((t) => t.priority)) - 1;
}
