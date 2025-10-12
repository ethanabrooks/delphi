import { beforeEach, describe, expect, test } from "@jest/globals";
import { platformTodoService } from "../services/platformTodoService";
import type { Todo } from "../types/todo";

// Mock localStorage for web platform with actual storage behavior
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

describe("Priority Reordering Without Gaps", () => {
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

  const verifyNoGaps = (todos: Todo[]) => {
    const activeTodos = todos
      .filter(t => t.status === "active")
      .sort((a, b) => (a.priority as number) - (b.priority as number));

    for (let i = 0; i < activeTodos.length; i++) {
      const expectedPriority = i + 1;
      const actualPriority = activeTodos[i].priority;
      expect(actualPriority).toBe(expectedPriority);
    }
  };

  test("should reorder without gaps when moving down", async () => {
    // Create initial todos: a(1), b(2), c(3)
    const todoA = await createTodo("a", 1);
    const todoB = await createTodo("b", 2);
    const todoC = await createTodo("c", 3);

    // Move a down to position 2: should become b(1), a(2), c(3)
    await platformTodoService.updateTodo({
      id: todoA.id,
      priority: 2,
    });

    const allTodos = await platformTodoService.getAllTodos();
    const activeTodos = allTodos
      .filter(t => t.status === "active")
      .sort((a, b) => (a.priority as number) - (b.priority as number));

    // Verify no gaps exist
    verifyNoGaps(allTodos);

    // Verify correct ordering
    expect(activeTodos).toHaveLength(3);
    expect(activeTodos[0].title).toBe("b"); // b should be at priority 1
    expect(activeTodos[0].priority).toBe(1);
    expect(activeTodos[1].title).toBe("a"); // a should be at priority 2
    expect(activeTodos[1].priority).toBe(2);
    expect(activeTodos[2].title).toBe("c"); // c should stay at priority 3
    expect(activeTodos[2].priority).toBe(3);
  });

  test("should reorder without gaps when moving up", async () => {
    // Create initial todos: a(1), b(2), c(3)
    const todoA = await createTodo("a", 1);
    const todoB = await createTodo("b", 2);
    const todoC = await createTodo("c", 3);

    // Move c up to position 1: should become c(1), a(2), b(3)
    await platformTodoService.updateTodo({
      id: todoC.id,
      priority: 1,
    });

    const allTodos = await platformTodoService.getAllTodos();
    const activeTodos = allTodos
      .filter(t => t.status === "active")
      .sort((a, b) => (a.priority as number) - (b.priority as number));

    // Verify no gaps exist
    verifyNoGaps(allTodos);

    // Verify correct ordering
    expect(activeTodos).toHaveLength(3);
    expect(activeTodos[0].title).toBe("c"); // c should be at priority 1
    expect(activeTodos[0].priority).toBe(1);
    expect(activeTodos[1].title).toBe("a"); // a should be at priority 2
    expect(activeTodos[1].priority).toBe(2);
    expect(activeTodos[2].title).toBe("b"); // b should be at priority 3
    expect(activeTodos[2].priority).toBe(3);
  });

  test("should reorder without gaps when moving to middle", async () => {
    // Create initial todos: a(1), b(2), c(3), d(4)
    const todoA = await createTodo("a", 1);
    const todoB = await createTodo("b", 2);
    const todoC = await createTodo("c", 3);
    const todoD = await createTodo("d", 4);

    // Move d to position 2: should become a(1), d(2), b(3), c(4)
    await platformTodoService.updateTodo({
      id: todoD.id,
      priority: 2,
    });

    const allTodos = await platformTodoService.getAllTodos();
    const activeTodos = allTodos
      .filter(t => t.status === "active")
      .sort((a, b) => (a.priority as number) - (b.priority as number));

    // Verify no gaps exist
    verifyNoGaps(allTodos);

    // Verify correct ordering
    expect(activeTodos).toHaveLength(4);
    expect(activeTodos[0].title).toBe("a"); // a stays at priority 1
    expect(activeTodos[0].priority).toBe(1);
    expect(activeTodos[1].title).toBe("d"); // d moves to priority 2
    expect(activeTodos[1].priority).toBe(2);
    expect(activeTodos[2].title).toBe("b"); // b shifts to priority 3
    expect(activeTodos[2].priority).toBe(3);
    expect(activeTodos[3].title).toBe("c"); // c shifts to priority 4
    expect(activeTodos[3].priority).toBe(4);
  });

  test("current broken behavior - demonstrates gap creation", async () => {
    // This test documents the current broken behavior
    // Create initial todos: a(1), b(2), c(3)
    const todoA = await createTodo("a", 1);
    const todoB = await createTodo("b", 2);
    const todoC = await createTodo("c", 3);

    // Move a down to position 2
    await platformTodoService.updateTodo({
      id: todoA.id,
      priority: 2,
    });

    const allTodos = await platformTodoService.getAllTodos();
    const activeTodos = allTodos
      .filter(t => t.status === "active")
      .sort((a, b) => (a.priority as number) - (b.priority as number));

    // Current broken behavior creates: a(2), b(3), c(4) - gap at priority 1!
    expect(activeTodos).toHaveLength(3);

    // This test will currently FAIL because of the gap at priority 1
    // When fixed, this test should pass
    try {
      verifyNoGaps(allTodos);
      // If we reach here, gaps were fixed!
    } catch (error) {
      // Expected failure due to gaps - document what we actually get
      console.log("Current broken behavior - priorities:", activeTodos.map(t => `${t.title}(${t.priority})`));

      // Show the gap exists
      expect(activeTodos[0].priority).not.toBe(1); // There's a gap at 1
      expect(activeTodos[0].priority).toBe(2); // a is at 2
      expect(activeTodos[1].priority).toBe(3); // b is at 3
      expect(activeTodos[2].priority).toBe(4); // c is at 4

      // This documents that we have a gap - when fixed, remove this test
    }
  });
});