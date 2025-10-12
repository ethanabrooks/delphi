import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import { resetTestData } from "../__test-utils__/testUtils";
import useTodosManager from "../hooks/useTodosManager";
import type { PlatformTodoService } from "../services/platformTodoService";

jest.mock("../db/database", () => ({
  initializeDatabase: jest.fn(async () => {}),
}));

type MockedModule = {
  isWebPlatform: boolean;
  platformTodoService: PlatformTodoService;
};

jest.mock("../services/platformTodoService", () => {
  const { createTestTodoService } = require("../__test-utils__/testUtils");
  return {
    isWebPlatform: true, // Set to true to avoid database initialization
    platformTodoService: createTestTodoService(),
  } satisfies MockedModule;
});

const { platformTodoService } =
  require("../services/platformTodoService") as MockedModule;

describe("useTodosManager", () => {
  beforeEach(() => {
    resetTestData();
  });

  const renderHookComponent = () => {
    const result = {
      current: null as ReturnType<typeof useTodosManager> | null,
    };

    const HookConsumer = () => {
      result.current = useTodosManager();
      return null;
    };

    render(<HookConsumer />);
    return result;
  };

  test("loads todos on mount", async () => {
    await platformTodoService.createTodo({ title: "First", priority: 1 });
    await platformTodoService.createTodo({ title: "Second", priority: 2 });

    const hookResult = renderHookComponent();

    await waitFor(() => expect(hookResult.current?.isLoading).toBe(false));
    expect(hookResult.current?.todos).toHaveLength(2);
  });

  test("adds a todo", async () => {
    const hookResult = renderHookComponent();
    await waitFor(() => expect(hookResult.current?.isLoading).toBe(false));

    await act(async () => {
      await hookResult.current?.addTodo({ title: "New Todo", priority: 1 });
    });

    expect(hookResult.current?.todos).toHaveLength(1);
    expect(hookResult.current?.todos[0].title).toBe("New Todo");
  });

  test("toggles a todo", async () => {
    await platformTodoService.createTodo({ title: "Toggle Me", priority: 1 });

    const hookResult = renderHookComponent();
    await waitFor(() => expect(hookResult.current?.isLoading).toBe(false));

    const todo = hookResult.current?.todos[0];
    expect(todo?.priority).toBeDefined();

    await act(async () => {
      if (todo) {
        await hookResult.current?.toggleTodo(todo.priority, todo.status);
      }
    });

    const updatedTodo = hookResult.current?.todos.find(
      (t) => t.priority === todo?.priority && t.status === "completed"
    );
    expect(updatedTodo?.status).toBe("completed");
  });
});
