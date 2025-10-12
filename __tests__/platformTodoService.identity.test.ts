import { beforeEach, describe, expect, jest, test } from "@jest/globals";

import type { Todo } from "../types/todo";

// Centralised Jest mocks for the native TodoService dependency.
// Each export delegates to the mutable mock functions below so that tests can
// customise behaviour per case without re-registering the module mock.
const mockTodoServiceMocks = {
  getAllTodos: jest.fn<() => Promise<Todo[]>>(),
  updateTodo: jest.fn<(id: number, input: unknown) => Promise<Todo | null>>(),
  deleteTodo: jest.fn<(id: number) => Promise<boolean>>(),
  createTodo: jest.fn<(input: unknown) => Promise<Todo>>(),
  getTodoById: jest.fn<(id: number) => Promise<Todo | null>>(),
  getActiveTodos: jest.fn<() => Promise<Todo[]>>(),
  getCompletedTodos: jest.fn<() => Promise<Todo[]>>(),
  getArchivedTodos: jest.fn<() => Promise<Todo[]>>(),
  clearAllTodos: jest.fn<() => Promise<void>>(),
  toggleTodo: jest.fn<(id: number) => Promise<Todo | null>>(),
  getTodoStats:
    jest.fn<
      () => Promise<{
        total: number;
        active: number;
        completed: number;
        archived: number;
      }>
    >(),
};

jest.mock("../services/todoService", () => ({
  TodoService: {
    getAllTodos: () => mockTodoServiceMocks.getAllTodos(),
    updateTodo: (id: number, input: unknown) =>
      mockTodoServiceMocks.updateTodo(id, input),
    deleteTodo: (id: number) => mockTodoServiceMocks.deleteTodo(id),
    createTodo: (input: unknown) => mockTodoServiceMocks.createTodo(input),
    getTodoById: (id: number) => mockTodoServiceMocks.getTodoById(id),
    getActiveTodos: () => mockTodoServiceMocks.getActiveTodos(),
    getCompletedTodos: () => mockTodoServiceMocks.getCompletedTodos(),
    getArchivedTodos: () => mockTodoServiceMocks.getArchivedTodos(),
    clearAllTodos: () => mockTodoServiceMocks.clearAllTodos(),
    toggleTodo: (id: number) => mockTodoServiceMocks.toggleTodo(id),
    getTodoStats: () => mockTodoServiceMocks.getTodoStats(),
  },
}));

const completedTodo = (overrides: Partial<Todo>): Todo => ({
  id: overrides.id ?? Math.floor(Math.random() * 10_000),
  title: overrides.title ?? "completed",
  description: overrides.description,
  due_date: overrides.due_date,
  created_at: overrides.created_at ?? "2024-01-01T00:00:00.000Z",
  updated_at: overrides.updated_at ?? "2024-01-01T00:00:00.000Z",
  status: "completed",
  priority: null,
});

describe("platformTodoService identity-sensitive operations", () => {
  beforeEach(() => {
    jest.resetModules();
    Object.values(mockTodoServiceMocks).forEach((mock) => {
      mock.mockReset();
    });
  });

  test("toggleTodo reactivates the matching completed todo by id", async () => {
    const todos: Todo[] = [
      completedTodo({ id: 10, title: "A" }),
      completedTodo({ id: 11, title: "B" }),
    ];

    mockTodoServiceMocks.getAllTodos.mockResolvedValue(todos);
    mockTodoServiceMocks.updateTodo.mockResolvedValue({
      ...todos[1],
      status: "active",
      priority: 1,
    });

    await new Promise<void>((resolve, reject) => {
      jest.isolateModules(() => {
        const originalWindow = (globalThis as { window?: unknown }).window;
        const originalDocument = (globalThis as { document?: unknown })
          .document;
        try {
          (globalThis as { window?: unknown }).window = undefined;
          (globalThis as { document?: unknown }).document = undefined;

          const {
            platformTodoService,
          } = require("../services/platformTodoService");
          platformTodoService
            .toggleTodo(11, "completed")
            .then(() => resolve())
            .catch(reject);
        } catch (error) {
          reject(error);
        } finally {
          (globalThis as { window?: unknown }).window = originalWindow;
          (globalThis as { document?: unknown }).document = originalDocument;
        }
      });
    });

    expect(mockTodoServiceMocks.updateTodo).toHaveBeenCalledTimes(1);
    expect(mockTodoServiceMocks.updateTodo).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ status: "active" })
    );
  });

  test("deleteTodo removes the matching completed todo by id", async () => {
    const todos: Todo[] = [
      completedTodo({ id: 21, title: "First" }),
      completedTodo({ id: 22, title: "Second" }),
    ];

    mockTodoServiceMocks.getAllTodos.mockResolvedValue(todos);
    mockTodoServiceMocks.deleteTodo.mockResolvedValue(true);

    await new Promise<void>((resolve, reject) => {
      jest.isolateModules(() => {
        const originalWindow = (globalThis as { window?: unknown }).window;
        const originalDocument = (globalThis as { document?: unknown })
          .document;
        try {
          (globalThis as { window?: unknown }).window = undefined;
          (globalThis as { document?: unknown }).document = undefined;

          const {
            platformTodoService,
          } = require("../services/platformTodoService");
          platformTodoService
            .deleteTodo(22, "completed")
            .then(() => resolve())
            .catch(reject);
        } catch (error) {
          reject(error);
        } finally {
          (globalThis as { window?: unknown }).window = originalWindow;
          (globalThis as { document?: unknown }).document = originalDocument;
        }
      });
    });

    expect(mockTodoServiceMocks.deleteTodo).toHaveBeenCalledTimes(1);
    expect(mockTodoServiceMocks.deleteTodo).toHaveBeenCalledWith(22);
  });
});
