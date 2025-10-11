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
    isWebPlatform: false,
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
    await platformTodoService.createTodo({ title: "First" });
    await platformTodoService.createTodo({ title: "Second" });

    const hookResult = renderHookComponent();

    await waitFor(() => expect(hookResult.current?.isLoading).toBe(false));
    expect(hookResult.current?.todos).toHaveLength(2);
  });

  test("adds a todo", async () => {
    const hookResult = renderHookComponent();
    await waitFor(() => expect(hookResult.current?.isLoading).toBe(false));

    await act(async () => {
      await hookResult.current?.addTodo({ title: "New Todo" });
    });

    expect(hookResult.current?.todos).toHaveLength(1);
    expect(hookResult.current?.todos[0].title).toBe("New Todo");
  });

  test("toggles a todo", async () => {
    await platformTodoService.createTodo({ title: "Toggle Me" });

    const hookResult = renderHookComponent();
    await waitFor(() => expect(hookResult.current?.isLoading).toBe(false));

    const todoId = hookResult.current?.todos[0].id;
    expect(todoId).toBeDefined();

    await act(async () => {
      if (todoId) {
        await hookResult.current?.toggleTodo(todoId);
      }
    });

    const updatedTodo = hookResult.current?.todos.find(
      (todo) => todo.id === todoId
    );
    expect(updatedTodo?.completed).toBe(true);
  });
});
