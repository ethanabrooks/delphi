import { describe, expect, test } from "@jest/globals";

import type { Todo } from "../types/todo";
import { getNextHighestPriority } from "../utils/priorityUtils";

const baseTodo = (overrides: Partial<Todo>): Todo =>
  ({
    id: 1,
    title: "stub",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    description: undefined,
    due_date: undefined,
    status: "active",
    priority: 1,
    ...overrides,
  }) as Todo;

describe("getNextHighestPriority", () => {
  test("returns 1 when there are no active todos", () => {
    const todos: Todo[] = [
      baseTodo({ id: 1, status: "completed", priority: 2 }),
    ];

    expect(getNextHighestPriority(todos, "active")).toBe(1);
  });

  test("returns max priority + 1 for existing active todos", () => {
    const todos: Todo[] = [
      baseTodo({ id: 1, status: "active", priority: 1 }),
      baseTodo({ id: 2, status: "active", priority: 2 }),
      baseTodo({ id: 3, status: "completed", priority: 5 }),
    ];

    expect(getNextHighestPriority(todos, "active")).toBe(3);
  });

  test("ignores gaps and still appends after the largest active priority", () => {
    const todos: Todo[] = [
      baseTodo({ id: 1, status: "active", priority: 1 }),
      baseTodo({ id: 2, status: "active", priority: 4 }),
      baseTodo({ id: 3, status: "archived", priority: 3 }),
    ];

    expect(getNextHighestPriority(todos, "active")).toBe(5);
  });
});
