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
      priority: 1,
    });

    expect(newTodo).toMatchObject({
      title: "Test Todo",
      description: "Test Description",
      status: "active",
    });
    expect(newTodo.priority).toBeDefined();
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
      priority: 1,
    });

    // Update the todo
    const updatedTodo = await TodoService.updateTodo({
      priority: newTodo.priority,
      status: newTodo.status,
      title: "Updated Todo",
    });

    expect(updatedTodo).toMatchObject({
      priority: newTodo.priority,
      title: "Updated Todo",
      description: "Test Description",
      status: "active",
    });

    // Toggle the todo
    const toggledTodo = await TodoService.toggleTodo(
      newTodo.priority,
      newTodo.status
    );
    expect(toggledTodo?.status).toBe("completed");
  });

  test("should delete todos", async () => {
    // Create a todo
    const newTodo = await TodoService.createTodo({
      title: "Test Todo",
      priority: 1,
    });

    // Verify it exists
    let allTodos = await TodoService.getAllTodos();
    expect(allTodos).toHaveLength(1);

    // Delete the todo
    const success = await TodoService.deleteTodo(
      newTodo.priority,
      newTodo.status
    );
    expect(success).toBe(true);

    // Verify it's gone
    allTodos = await TodoService.getAllTodos();
    expect(allTodos).toHaveLength(0);
  });

  test("should filter todos by completion status", async () => {
    // Create some todos
    await TodoService.createTodo({ title: "Todo 1", priority: 1 });
    const todo2 = await TodoService.createTodo({
      title: "Todo 2",
      priority: 2,
    });
    await TodoService.createTodo({ title: "Todo 3", priority: 3 });

    // Complete one todo
    await TodoService.toggleTodo(todo2.priority, todo2.status);

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
    const _todo1 = await TodoService.createTodo({
      title: "Active Todo",
      priority: 1,
    });
    const todo2 = await TodoService.createTodo({
      title: "To Complete",
      priority: 2,
    });
    const todo3 = await TodoService.createTodo({
      title: "To Archive",
      priority: 3,
    });

    // Change statuses
    await TodoService.toggleTodo(todo2.priority, todo2.status); // Mark as completed
    await TodoService.updateTodo({
      priority: todo3.priority,
      status: todo3.status,
      newStatus: "archived",
    });

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
    const _todo1 = await TodoService.createTodo({
      title: "Todo 1",
      priority: 1,
    });
    const todo2 = await TodoService.createTodo({
      title: "Todo 2",
      priority: 2,
    });
    const todo3 = await TodoService.createTodo({
      title: "Todo 3",
      priority: 3,
    });

    // Change statuses
    await TodoService.toggleTodo(todo2.priority, todo2.status); // Mark as completed
    await TodoService.updateTodo({
      priority: todo3.priority,
      status: todo3.status,
      newStatus: "archived",
    });

    // Get stats
    const stats = await TodoService.getTodoStats();

    expect(stats).toEqual({
      total: 3,
      active: 1,
      completed: 1,
      archived: 1,
    });
  });

  test("updateTodo should handle priority changes with bumping", async () => {
    // Create three todos with specific priorities
    const _todo1 = await TodoService.createTodo({
      title: "First",
      priority: 1,
    });
    const _todo2 = await TodoService.createTodo({
      title: "Second",
      priority: 2,
    });
    const todo3 = await TodoService.createTodo({ title: "Third", priority: 3 });

    // Move todo3 (priority 3) to priority 2
    // This should bump todo2 from priority 2 to priority 3
    await TodoService.updateTodo({
      priority: todo3.priority,
      status: todo3.status,
      newPriority: 2,
    });

    // Get all todos and verify the new ordering
    const allTodos = await TodoService.getAllTodos();

    // Should be ordered by priority: 1, 2, 3
    expect(allTodos[0].title).toBe("First");
    expect(allTodos[0].priority).toBe(1);

    expect(allTodos[1].title).toBe("Third"); // Originally priority 3, moved to 2
    expect(allTodos[1].priority).toBe(2);

    expect(allTodos[2].title).toBe("Second"); // Originally priority 2, bumped to 3
    expect(allTodos[2].priority).toBe(3);
  });
});
