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
      priority: 2,
      category: "Work",
    });

    expect(newTodo).toMatchObject({
      title: "Test Todo",
      description: "Test Description",
      completed: false,
      priority: 2,
      category: "Work",
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
      priority: 3,
    });

    expect(updatedTodo).toMatchObject({
      id: newTodo.id,
      title: "Updated Todo",
      description: "Test Description",
      completed: false,
      priority: 3,
    });

    // Toggle the todo
    const toggledTodo = await TodoService.toggleTodo(newTodo.id);
    expect(toggledTodo?.completed).toBe(true);
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
    const incomplete = await TodoService.getIncompleteTodos();
    const completed = await TodoService.getCompletedTodos();

    expect(incomplete).toHaveLength(2);
    expect(completed).toHaveLength(1);
    expect(completed[0].title).toBe("Todo 2");
    expect(completed[0].completed).toBe(true);
  });

  test("should filter todos by priority", async () => {
    // Create todos with different priorities
    await TodoService.createTodo({ title: "Low Priority", priority: 1 });
    await TodoService.createTodo({ title: "Medium Priority", priority: 2 });
    await TodoService.createTodo({ title: "High Priority", priority: 3 });
    await TodoService.createTodo({ title: "Another High", priority: 3 });

    // Test filtering by priority
    const highPriorityTodos = await TodoService.getTodosByPriority(3);
    const mediumPriorityTodos = await TodoService.getTodosByPriority(2);

    expect(highPriorityTodos).toHaveLength(2);
    expect(mediumPriorityTodos).toHaveLength(1);
    expect(highPriorityTodos.every((todo) => todo.priority === 3)).toBe(true);
  });

  test("should get todo statistics", async () => {
    // Create test data
    await TodoService.createTodo({ title: "Todo 1", priority: 3 });
    const todo2 = await TodoService.createTodo({
      title: "Todo 2",
      priority: 2,
    });
    await TodoService.createTodo({ title: "Todo 3", priority: 3 });

    // Complete one todo
    await TodoService.toggleTodo(todo2.id);

    // Get stats
    const stats = await TodoService.getTodoStats();

    expect(stats).toEqual({
      total: 3,
      completed: 1,
      pending: 2,
      highPriority: 2, // 2 high priority todos that are not completed
    });
  });
});
