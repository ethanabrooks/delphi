import { beforeEach, describe, expect, test } from "@jest/globals";
import { platformTodoService } from "../services/platformTodoService";
import type { Todo } from "../types/todo";

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

describe("Undo Functionality Issues", () => {
  beforeEach(() => {
    // Clear mock storage
    mockStorage = {};
    mockLocalStorage.setItem.mockClear();
  });

  const createTodo = async (title: string, priority: number): Promise<Todo> => {
    return platformTodoService.createTodo({
      title,
      priority,
    });
  };

  test("should distinguish between undoing complete vs undoing archive", async () => {
    // Create initial todos
    const todoA = await createTodo("Todo A", 1);
    const todoB = await createTodo("Todo B", 2);
    const _todoC = await createTodo("Todo C", 3);

    // Mark one as completed
    const completedTodo = await platformTodoService.updateTodo({
      id: todoA.id,
      status: "completed",
    });
    expect(completedTodo?.status).toBe("completed");

    // Mark one as archived
    const archivedTodo = await platformTodoService.updateTodo({
      id: todoB.id,
      status: "archived",
    });
    expect(archivedTodo?.status).toBe("archived");

    console.log("=== INITIAL STATE ===");
    const initialState = await platformTodoService.getAllTodos();
    console.log(
      "Active:",
      initialState
        .filter((t) => t.status === "active")
        .map((t) => `${t.title}(${t.status})`)
    );
    console.log(
      "Completed:",
      initialState
        .filter((t) => t.status === "completed")
        .map((t) => `${t.title}(${t.status})`)
    );
    console.log(
      "Archived:",
      initialState
        .filter((t) => t.status === "archived")
        .map((t) => `${t.title}(${t.status})`)
    );

    // ISSUE: Both completed and archived todos toggle to "active"
    // There's no way to undo just completion vs just archiving

    console.log("=== TOGGLE COMPLETED TODO ===");
    const uncompletedTodo = await platformTodoService.toggleCompleted(todoA.id);
    console.log(
      `Toggling completed "${todoA.title}": ${completedTodo?.status} → ${uncompletedTodo?.status}`
    );

    console.log("=== TOGGLE ARCHIVED TODO ===");
    const unarchivedTodo = await platformTodoService.toggleArchived(todoB.id);
    console.log(
      `Toggling archived "${todoB.title}": ${archivedTodo?.status} → ${unarchivedTodo?.status}`
    );

    // PROBLEM: Both become "active" - we can't distinguish the undo operations
    expect(uncompletedTodo?.status).toBe("active");
    expect(unarchivedTodo?.status).toBe("active");

    console.log("=== FINAL STATE ===");
    const finalState = await platformTodoService.getAllTodos();
    console.log(
      "Active:",
      finalState
        .filter((t) => t.status === "active")
        .map((t) => `${t.title}(${t.status})`)
    );
    console.log(
      "Completed:",
      finalState
        .filter((t) => t.status === "completed")
        .map((t) => `${t.title}(${t.status})`)
    );
    console.log(
      "Archived:",
      finalState
        .filter((t) => t.status === "archived")
        .map((t) => `${t.title}(${t.status})`)
    );

    // This demonstrates the issue: we lost the distinction between completed and archived
    // Both todos are now active, but we can't tell which one was originally completed vs archived
  });

  test("should preserve original status when toggling back from active", async () => {
    // Create and complete a todo
    const todo = await createTodo("Test Todo", 1);
    await platformTodoService.updateTodo({
      id: todo.id,
      status: "completed",
    });

    // Toggle to active (should work)
    const reactivated = await platformTodoService.toggleCompleted(todo.id);
    expect(reactivated?.status).toBe("active");

    // ISSUE: Toggle again - should go back to "completed" but goes to "completed"
    // This works correctly for completed todos, but what about archived?
    const retriggered = await platformTodoService.toggleCompleted(todo.id);
    expect(retriggered?.status).toBe("completed");

    console.log(
      `Todo lifecycle: active → completed → active → ${retriggered?.status}`
    );
  });

  test("archived todos cannot be properly restored to archived status", async () => {
    // Create and archive a todo
    const todo = await createTodo("Archived Todo", 1);
    await platformTodoService.updateTodo({
      id: todo.id,
      status: "archived",
    });

    console.log("=== ARCHIVE UNDO ISSUE ===");

    // Toggle archived todo to active
    const reactivated = await platformTodoService.toggleArchived(todo.id);
    expect(reactivated?.status).toBe("active");
    console.log(`Step 1: archived → ${reactivated?.status}`);

    // PROBLEM: Toggle again - should go back to "archived" but goes to "completed"!
    const retriggered = await platformTodoService.toggleArchived(todo.id);
    expect(retriggered?.status).toBe("archived"); // Now correct!
    console.log(
      `Step 2: active → ${retriggered?.status} (FIXED! Now correctly archived)`
    );

    // This demonstrates the fix:
    // Now we have separate toggleCompleted and toggleArchived methods
    // toggleArchived: active ↔ archived
    // toggleCompleted: active ↔ completed
    // So archived todos can be properly restored to archived status
  });

  test("demonstrates the lost information problem", async () => {
    const todoA = await createTodo("Originally Completed", 1);
    const todoB = await createTodo("Originally Archived", 2);

    // Set different statuses
    await platformTodoService.updateTodo({ id: todoA.id, status: "completed" });
    await platformTodoService.updateTodo({ id: todoB.id, status: "archived" });

    // Reactivate both via toggle
    await platformTodoService.toggleCompleted(todoA.id);
    await platformTodoService.toggleArchived(todoB.id);

    // Now both are active - we've lost the information about their original states
    const todos = await platformTodoService.getAllTodos();
    const active = todos.filter((t) => t.status === "active");

    expect(active).toHaveLength(2);
    console.log("Both todos are active - original status information is lost");

    // If we toggle both again, they'll both go back to their appropriate states
    const toggledA = await platformTodoService.toggleCompleted(todoA.id);
    const toggledB = await platformTodoService.toggleArchived(todoB.id);

    expect(toggledA?.status).toBe("completed"); // Correct
    expect(toggledB?.status).toBe("archived"); // Now correct! Should be "archived"

    console.log(
      "FIXED: Now todos can be properly toggled back to their correct states"
    );
  });
});
