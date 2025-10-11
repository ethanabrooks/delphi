import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { resetTestData } from "../__test-utils__/testUtils";
import { useTodoStore } from "../stores/simpleTodoStore";

// Mock the TodoService to use our in-memory test implementation
jest.mock("../services/todoService", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { mockTodoServiceForTesting } = require("../__test-utils__/testUtils");
  return mockTodoServiceForTesting();
});

describe("TodoStore Integration Tests - Working Version", () => {
  beforeEach(() => {
    resetTestData();
  });

  test("should add todo and update store state", async () => {
    // Reset the store state
    useTodoStore.setState({
      todos: [],
      isLoading: false,
      error: null,
    });

    const { addTodo } = useTodoStore.getState();

    await addTodo({
      title: "Test Todo",
      description: "Test Description",
      priority: 2,
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
    // Reset the store state
    useTodoStore.setState({
      todos: [],
      isLoading: false,
      error: null,
    });

    const { addTodo, toggleTodo } = useTodoStore.getState();

    // Add a todo first
    await addTodo({ title: "Test Todo" });
    const todoId = useTodoStore.getState().todos[0].id;

    // Toggle it
    await toggleTodo(todoId);

    const state = useTodoStore.getState();
    expect(state.todos[0].completed).toBe(true);
  });

  test("should delete todo", async () => {
    const { addTodo, deleteTodo } = useTodoStore.getState();

    // Add a todo first
    await addTodo({ title: "Test Todo" });
    const todoId = useTodoStore.getState().todos[0].id;

    // Delete it
    await deleteTodo(todoId);

    const state = useTodoStore.getState();
    expect(state.todos).toHaveLength(0);
  });

  test("should get filtered todos", async () => {
    const { addTodo, toggleTodo, getIncompleteTodos, getCompletedTodos } =
      useTodoStore.getState();

    // Add todos
    await addTodo({ title: "Todo 1" });
    await addTodo({ title: "Todo 2" });
    await addTodo({ title: "Todo 3" });

    // Complete one
    const todoId = useTodoStore.getState().todos[1].id;
    await toggleTodo(todoId);

    const incomplete = getIncompleteTodos();
    const completed = getCompletedTodos();

    expect(incomplete).toHaveLength(2);
    expect(completed).toHaveLength(1);
    expect(completed[0].completed).toBe(true);
  });
});
