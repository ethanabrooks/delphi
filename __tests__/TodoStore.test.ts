import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act } from "@testing-library/react-native";
import { resetTestData } from "../__test-utils__/testUtils";
import { TodoService } from "../services/todoService";
import { useTodoStore } from "../stores/simpleTodoStore";

// Mock the TodoService to use our in-memory test implementation
jest.mock("../services/todoService", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { mockTodoServiceForTesting } = require("../__test-utils__/testUtils");
  return mockTodoServiceForTesting();
});

describe("TodoStore Integration Tests", () => {
  beforeEach(() => {
    resetTestData();
    // Reset the store state
    act(() => {
      useTodoStore.setState({
        todos: [],
        isLoading: false,
        error: null,
      });
    });
  });

  test("should initialize with empty state", () => {
    const state = useTodoStore.getState();
    expect(state.todos).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(null);
  });

  test("should add todo and update store state", async () => {
    const { addTodo } = useTodoStore.getState();

    await act(async () => {
      await addTodo({
        title: "Test Todo",
        description: "Test Description",
        priority: 2,
      });
    });

    const state = useTodoStore.getState();
    expect(state.todos).toHaveLength(1);
    expect(state.todos[0]).toMatchObject({
      title: "Test Todo",
      description: "Test Description",
      completed: false,
      priority: 2,
    });
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(null);
  });

  test("should toggle todo completion", async () => {
    const { addTodo, toggleTodo } = useTodoStore.getState();

    // Add a todo first
    await act(async () => {
      await addTodo({ title: "Test Todo" });
    });
    const todoId = useTodoStore.getState().todos[0].id;

    // Toggle it
    await act(async () => {
      await toggleTodo(todoId);
    });

    const state = useTodoStore.getState();
    expect(state.todos[0].completed).toBe(true);
  });

  test("should update todo", async () => {
    const { addTodo, updateTodo } = useTodoStore.getState();

    // Add a todo first
    await act(async () => {
      await addTodo({ title: "Original Title", priority: 1 });
    });
    const todoId = useTodoStore.getState().todos[0].id;

    // Update it
    await act(async () => {
      await updateTodo({
        id: todoId,
        title: "Updated Title",
        priority: 3,
      });
    });

    const state = useTodoStore.getState();
    expect(state.todos[0]).toMatchObject({
      title: "Updated Title",
      priority: 3,
    });
  });

  test("should delete todo", async () => {
    const { addTodo, deleteTodo } = useTodoStore.getState();

    // Add a todo first
    await act(async () => {
      await addTodo({ title: "Test Todo" });
    });
    const todoId = useTodoStore.getState().todos[0].id;

    // Delete it
    await act(async () => {
      await deleteTodo(todoId);
    });

    const state = useTodoStore.getState();
    expect(state.todos).toHaveLength(0);
  });

  test("should load todos from service", async () => {
    const { loadTodos } = useTodoStore.getState();

    // Add todos directly to the test service
    await TodoService.createTodo({ title: "Todo 1" });
    await TodoService.createTodo({ title: "Todo 2" });

    // Load todos into store
    await act(async () => {
      await loadTodos();
    });

    const state = useTodoStore.getState();
    expect(state.todos).toHaveLength(2);
    expect(state.todos.map((t) => t.title)).toEqual(
      expect.arrayContaining(["Todo 1", "Todo 2"])
    );
  });

  test("should clear all todos", async () => {
    const { addTodo, clearAllTodos } = useTodoStore.getState();

    // Add some todos
    await act(async () => {
      await addTodo({ title: "Todo 1" });
    });
    await act(async () => {
      await addTodo({ title: "Todo 2" });
    });

    // Clear all
    await act(async () => {
      await clearAllTodos();
    });

    const state = useTodoStore.getState();
    expect(state.todos).toHaveLength(0);
  });

  test("should get todo by id", async () => {
    const { addTodo, getTodoById } = useTodoStore.getState();

    await act(async () => {
      await addTodo({ title: "Test Todo" });
    });
    const todoId = useTodoStore.getState().todos[0].id;

    const todo = getTodoById(todoId);
    expect(todo).toMatchObject({ title: "Test Todo" });

    const nonExistent = getTodoById(999);
    expect(nonExistent).toBeUndefined();
  });

  test("should filter incomplete todos", async () => {
    const { addTodo, toggleTodo, getIncompleteTodos } = useTodoStore.getState();

    // Add todos
    await act(async () => {
      await addTodo({ title: "Todo 1" });
    });
    await act(async () => {
      await addTodo({ title: "Todo 2" });
    });
    await act(async () => {
      await addTodo({ title: "Todo 3" });
    });

    // Complete one
    const todoId = useTodoStore.getState().todos[1].id;
    await act(async () => {
      await toggleTodo(todoId);
    });

    const incomplete = getIncompleteTodos();
    expect(incomplete).toHaveLength(2);
    expect(incomplete.every((t) => !t.completed)).toBe(true);
  });

  test("should filter completed todos", async () => {
    const { addTodo, toggleTodo, getCompletedTodos } = useTodoStore.getState();

    // Add todos
    await act(async () => {
      await addTodo({ title: "Todo 1" });
    });
    await act(async () => {
      await addTodo({ title: "Todo 2" });
    });

    // Complete one
    const todoId = useTodoStore.getState().todos[0].id;
    await act(async () => {
      await toggleTodo(todoId);
    });

    const completed = getCompletedTodos();
    expect(completed).toHaveLength(1);
    expect(completed[0].completed).toBe(true);
  });

  test("should filter todos by priority", async () => {
    const { addTodo, getTodosByPriority } = useTodoStore.getState();

    await act(async () => {
      await addTodo({ title: "Low Priority", priority: 1 });
    });
    await act(async () => {
      await addTodo({ title: "High Priority", priority: 3 });
    });
    await act(async () => {
      await addTodo({ title: "Another High", priority: 3 });
    });

    const highPriority = getTodosByPriority(3);
    expect(highPriority).toHaveLength(2);
    expect(highPriority.every((t) => t.priority === 3)).toBe(true);
  });

  test("should handle loading states during operations", async () => {
    const { addTodo } = useTodoStore.getState();

    // Start the async operation
    await act(async () => {
      const promise = addTodo({ title: "Test Todo" });

      // Check loading state (this might be tricky to test due to timing)
      // For now, just ensure the operation completes
      await promise;
    });

    const state = useTodoStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(null);
  });

  test("should handle errors gracefully", async () => {
    // Mock a failing service method
    const originalMethod = TodoService.createTodo;
    TodoService.createTodo = jest
      .fn<typeof TodoService.createTodo>()
      .mockRejectedValue(new Error("Service error"));

    const { addTodo } = useTodoStore.getState();

    await act(async () => {
      await addTodo({ title: "Test Todo" });
    });

    const state = useTodoStore.getState();
    expect(state.error).toContain("Failed to add todo");
    expect(state.todos).toHaveLength(0);
    expect(state.isLoading).toBe(false);

    // Restore original method
    TodoService.createTodo = originalMethod;
  });
});
