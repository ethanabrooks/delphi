import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";

import type { Todo } from "../types/todo";

const stubTimestamp = "2024-01-01T00:00:00.000Z";

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe("useTodosManager regressions", () => {
  test("updateTodo replaces the original todo even when priority changes", async () => {
    const initialTodo: Todo = {
      id: 42,
      title: "Initial",
      description: undefined,
      due_date: undefined,
      created_at: stubTimestamp,
      updated_at: stubTimestamp,
      status: "active",
      priority: 3,
    };

    const updatedTodo: Todo = {
      ...initialTodo,
      priority: 1,
      updated_at: "2024-01-02T00:00:00.000Z",
    };

    const platformMock = {
      getAllTodos: jest.fn(async () => [initialTodo]),
      createTodo: jest.fn(),
      deleteTodo: jest.fn(),
      toggleTodo: jest.fn(),
      getTodoStats: jest.fn(),
      getActiveTodos: jest.fn(),
      getCompletedTodos: jest.fn(),
      getArchivedTodos: jest.fn(),
      getTodosByStatus: jest.fn(),
      getTodoByIdentifier: jest.fn(),
      clearAllTodos: jest.fn(),
      updateTodo: jest.fn(async () => updatedTodo),
    };

    jest.doMock("../services/platformTodoService", () => ({
      isWebPlatform: true,
      platformTodoService: platformMock,
    }));

    jest.doMock("../db/database", () => ({
      initializeDatabase: jest.fn(),
    }));

    let useTodosManager!: typeof import("../hooks/useTodosManager").default;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      useTodosManager = require("../hooks/useTodosManager").default;
    });

    const result: { current: ReturnType<typeof useTodosManager> | null } = {
      current: null,
    };

    const HookConsumer = () => {
      result.current = useTodosManager();
      return null;
    };

    render(<HookConsumer />);

    await waitFor(() => expect(result.current?.isLoading).toBe(false));

    await act(async () => {
      await result.current?.updateTodo({
        id: initialTodo.id,
        priority: 1,
      });
    });

    expect(platformMock.updateTodo).toHaveBeenCalledWith({
      id: initialTodo.id,
      priority: 1,
    });

    expect(result.current?.todos).toHaveLength(1);
    expect(result.current?.todos?.[0].priority).toBe(1);
  });
});
