import type { Todo, TodoStatus } from "../types/todo";

/**
 * Returns the next available priority for new todos (1-based system).
 * For active todos, finds the highest priority and adds 1.
 * For non-active todos, priority is not relevant (will be set to null).
 *
 * @param todos - Array of existing todos
 * @param status - Status to calculate priority for
 * @returns Next priority (1-based, starting from 1)
 */
export function getNextHighestPriority(
  todos: Todo[],
  status: TodoStatus
): number {
  if (status !== "active") {
    // Non-active todos don't need meaningful priorities (will be set to null)
    return 1;
  }

  const activeTodos = todos.filter(
    (todo) => todo.status === "active" && todo.priority !== null
  );
  if (activeTodos.length === 0) {
    return 1; // First active todo gets priority 1
  }

  const maxPriority = Math.max(
    ...activeTodos.map((todo) => todo.priority as number)
  );
  return maxPriority + 1;
}
