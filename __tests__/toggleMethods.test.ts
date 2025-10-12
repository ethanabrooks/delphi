import { beforeEach, describe, expect, test } from "@jest/globals";
import { platformTodoService } from "../services/platformTodoService";

// Mock localStorage for web platform
let mockStorage: Record<string, string> = {};

const mockLocalStorage = {
  getItem: jest.fn((key: string) => mockStorage[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: jest.fn(() => {
    mockStorage = {};
  }),
};

Object.defineProperty(global, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// Force web platform for consistent testing
jest.mock("../services/platformTodoService", () => {
  const actual = jest.requireActual("../services/platformTodoService");
  return {
    ...actual,
    isWebPlatform: true,
  };
});

describe("Toggle Methods", () => {
  beforeEach(() => {
    mockStorage = {};
  });

  test("toggleCompleted works correctly", async () => {
    // Create an active todo
    const todo = await platformTodoService.createTodo({
      title: "Test Todo",
      priority: 1,
    });

    expect(todo.status).toBe("active");

    // Toggle to completed
    const completed = await platformTodoService.toggleCompleted(todo.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.priority).toBe(1); // Priority preserved

    // Toggle back to active
    expect(completed).not.toBeNull();
    const reactivated = await platformTodoService.toggleCompleted(
      completed?.id
    );
    expect(reactivated?.status).toBe("active");
    expect(reactivated?.priority).toBe(1);
  });

  test("toggleArchived works correctly", async () => {
    // Create an active todo
    const todo = await platformTodoService.createTodo({
      title: "Test Todo",
      priority: 2,
    });

    expect(todo.status).toBe("active");

    // Toggle to archived
    const archived = await platformTodoService.toggleArchived(todo.id);
    expect(archived?.status).toBe("archived");
    expect(archived?.priority).toBe(2); // Priority preserved

    // Toggle back to active
    expect(archived).not.toBeNull();
    const reactivated = await platformTodoService.toggleArchived(archived?.id);
    expect(reactivated?.status).toBe("active");
    expect(reactivated?.priority).toBe(1); // Reactivated at priority 1
  });

  test("toggleCompleted cannot toggle archived todos", async () => {
    // Create and archive a todo
    const todo = await platformTodoService.createTodo({
      title: "Test Todo",
      priority: 1,
    });

    const archived = await platformTodoService.updateTodo({
      id: todo.id,
      status: "archived",
    });

    // Try to toggle archived todo with toggleCompleted - should be unchanged
    expect(archived).not.toBeNull();
    const result = await platformTodoService.toggleCompleted(archived?.id);
    expect(result?.status).toBe("archived"); // Should remain archived
  });

  test("toggleArchived cannot toggle completed todos", async () => {
    // Create and complete a todo
    const todo = await platformTodoService.createTodo({
      title: "Test Todo",
      priority: 1,
    });

    const completed = await platformTodoService.updateTodo({
      id: todo.id,
      status: "completed",
    });

    // Try to toggle completed todo with toggleArchived - should be unchanged
    expect(completed).not.toBeNull();
    const result = await platformTodoService.toggleArchived(completed?.id);
    expect(result?.status).toBe("completed"); // Should remain completed
  });

  test("undo functionality works correctly", async () => {
    // Create two todos
    const todoA = await platformTodoService.createTodo({
      title: "Todo A",
      priority: 1,
    });
    const todoB = await platformTodoService.createTodo({
      title: "Todo B",
      priority: 2,
    });

    // Complete one, archive the other
    const completedA = await platformTodoService.updateTodo({
      id: todoA.id,
      status: "completed",
    });
    const archivedB = await platformTodoService.updateTodo({
      id: todoB.id,
      status: "archived",
    });

    expect(completedA?.status).toBe("completed");
    expect(archivedB?.status).toBe("archived");

    // Toggle both back to active using appropriate methods
    expect(completedA).not.toBeNull();
    const uncompletedA = await platformTodoService.toggleCompleted(
      completedA?.id
    );
    expect(archivedB).not.toBeNull();
    const unarchivedB = await platformTodoService.toggleArchived(archivedB?.id);

    expect(uncompletedA?.status).toBe("active");
    expect(unarchivedB?.status).toBe("active");

    // Toggle them again - they should go back to their original states
    expect(uncompletedA).not.toBeNull();
    const retriggeredA = await platformTodoService.toggleCompleted(
      uncompletedA?.id
    );
    expect(unarchivedB).not.toBeNull();
    const retriggeredB = await platformTodoService.toggleArchived(
      unarchivedB?.id
    );

    expect(retriggeredA?.status).toBe("completed");
    expect(retriggeredB?.status).toBe("archived");
  });
});
