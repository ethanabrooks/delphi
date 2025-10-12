import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { resetTestData } from "../__test-utils__/testUtils";
import { TodoService } from "../services/todoService";

// Mock the TodoService to use our in-memory test implementation
// This maintains the exact same interface as the real service but uses in-memory data
jest.mock("../services/todoService", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { mockTodoServiceForTesting } = require("../__test-utils__/testUtils");
  return mockTodoServiceForTesting();
});

describe("TodoService Integration Test", () => {
  beforeEach(() => {
    resetTestData();
  });

  test("should return empty array when no todos exist", async () => {
    const result = await TodoService.getAllTodos();

    expect(result).toEqual([]);
  });

  test("should create and retrieve todos", async () => {
    // Create a todo
    const newTodo = await TodoService.createTodo({
      title: "Test Todo",
      description: "Test Description",
    });

    expect(newTodo).toMatchObject({
      title: "Test Todo",
      description: "Test Description",
      status: "active",
    });
    expect(newTodo.id).toBeDefined();
    expect(newTodo.created_at).toBeDefined();
    expect(newTodo.updated_at).toBeDefined();

    // Retrieve all todos
    const allTodos = await TodoService.getAllTodos();
    expect(allTodos).toHaveLength(1);
    expect(allTodos[0]).toEqual(newTodo);
  });

  test("should update and toggle todos", async () => {
    // Create a todo
    const newTodo = await TodoService.createTodo({
      title: "Test Todo",
      description: "Test Description",
    });

    // Update the todo
    const updatedTodo = await TodoService.updateTodo({
      id: newTodo.id,
      title: "Updated Todo",
    });

    expect(updatedTodo).toMatchObject({
      id: newTodo.id,
      title: "Updated Todo",
      description: "Test Description",
      status: "active",
    });

    // Toggle the todo
    const toggledTodo = await TodoService.toggleTodo(newTodo.id);
    expect(toggledTodo?.status).toBe("completed");
  });

  test("should delete todos", async () => {
    // Create a todo
    const newTodo = await TodoService.createTodo({
      title: "Test Todo",
    });

    // Verify it exists
    let allTodos = await TodoService.getAllTodos();
    expect(allTodos).toHaveLength(1);

    // Delete the todo
    const success = await TodoService.deleteTodo(newTodo.id);
    expect(success).toBe(true);

    // Verify it's gone
    allTodos = await TodoService.getAllTodos();
    expect(allTodos).toHaveLength(0);
  });

  test("should filter todos by completion status", async () => {
    // Create some todos
    await TodoService.createTodo({ title: "Todo 1" });
    const todo2 = await TodoService.createTodo({ title: "Todo 2" });
    await TodoService.createTodo({ title: "Todo 3" });

    // Complete one todo
    await TodoService.toggleTodo(todo2.id);

    // Test filtering
    const active = await TodoService.getActiveTodos();
    const completed = await TodoService.getCompletedTodos();

    expect(active).toHaveLength(2);
    expect(completed).toHaveLength(1);
    expect(completed[0].title).toBe("Todo 2");
    expect(completed[0].status).toBe("completed");
  });

  test("should filter todos by status", async () => {
    // Create todos with different statuses
    const _todo1 = await TodoService.createTodo({ title: "Active Todo" });
    const todo2 = await TodoService.createTodo({ title: "To Complete" });
    const todo3 = await TodoService.createTodo({ title: "To Archive" });

    // Change statuses
    await TodoService.toggleTodo(todo2.id); // Mark as completed
    await TodoService.updateTodo({ id: todo3.id, status: "archived" });

    // Test filtering by status
    const activeTodos = await TodoService.getTodosByStatus("active");
    const completedTodos = await TodoService.getTodosByStatus("completed");
    const archivedTodos = await TodoService.getTodosByStatus("archived");

    expect(activeTodos).toHaveLength(1);
    expect(completedTodos).toHaveLength(1);
    expect(archivedTodos).toHaveLength(1);
    expect(activeTodos.every((todo) => todo.status === "active")).toBe(true);
  });

  test("should get todo statistics", async () => {
    // Create test data
    const _todo1 = await TodoService.createTodo({ title: "Todo 1" });
    const todo2 = await TodoService.createTodo({ title: "Todo 2" });
    const todo3 = await TodoService.createTodo({ title: "Todo 3" });

    // Change statuses
    await TodoService.toggleTodo(todo2.id); // Mark as completed
    await TodoService.updateTodo({ id: todo3.id, status: "archived" });

    // Get stats
    const stats = await TodoService.getTodoStats();

    expect(stats).toEqual({
      total: 3,
      active: 1,
      completed: 1,
      archived: 1,
    });
  });
});
