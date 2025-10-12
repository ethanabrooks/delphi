import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { resetTestData } from "../__test-utils__/testUtils";
import { TodoService } from "../services/todoService";

// Mock the TodoService to use our in-memory test implementation
// This allows us to test gap prevention logic without database complexity
jest.mock("../services/todoService", () => {
  const { mockTodoServiceForTesting } = require("../__test-utils__/testUtils");
  return mockTodoServiceForTesting();
});

// Helper function to verify no gaps exist in active priorities
async function verifyNoGaps(): Promise<void> {
  const activeTodos = await TodoService.getActiveTodos();

  // Sort by priority to check sequence
  const sortedTodos = [...activeTodos].sort((a, b) => {
    if (a.priority === null || b.priority === null) {
      throw new Error("Active todos should never have null priority");
    }
    return a.priority - b.priority;
  });

  // Verify dense sequence: 1, 2, 3, 4, ...
  for (let i = 0; i < sortedTodos.length; i++) {
    const expectedPriority = i + 1;
    const actualPriority = sortedTodos[i].priority;

    expect(actualPriority).toBe(expectedPriority);
  }
}

// Helper function to create a todo and return its ID
async function createTodoAtPriority(
  title: string,
  priority: number
): Promise<number> {
  const todo = await TodoService.createTodo({
    title,
    priority,
    description: `Test todo at priority ${priority}`,
  });
  return todo.id;
}

describe("TodoService Gap Prevention", () => {
  beforeEach(() => {
    resetTestData();
  });

  describe("Delete Operations Gap Closure", () => {
    test("should close gap when deleting middle todo", async () => {
      // Create todos at priorities 1, 2, 3, 4, 5
      await createTodoAtPriority("Todo 1", 1);
      const id2 = await createTodoAtPriority("Todo 2", 2);
      await createTodoAtPriority("Todo 3", 3);
      await createTodoAtPriority("Todo 4", 4);
      await createTodoAtPriority("Todo 5", 5);

      await verifyNoGaps(); // Initial state: [1,2,3,4,5]

      // Delete todo at priority 2
      await TodoService.deleteTodo(id2);

      await verifyNoGaps(); // Should be [1,2,3,4] (priorities 3,4,5 become 2,3,4)

      const activeTodos = await TodoService.getActiveTodos();
      expect(activeTodos).toHaveLength(4);
    });

    test("should close gap when deleting first todo", async () => {
      const id1 = await createTodoAtPriority("Todo 1", 1);
      await createTodoAtPriority("Todo 2", 2);
      await createTodoAtPriority("Todo 3", 3);

      await verifyNoGaps(); // Initial: [1,2,3]

      // Delete first todo
      await TodoService.deleteTodo(id1);

      await verifyNoGaps(); // Should be [1,2] (priorities 2,3 become 1,2)

      const activeTodos = await TodoService.getActiveTodos();
      expect(activeTodos).toHaveLength(2);
    });

    test("should handle deleting last todo without creating gaps", async () => {
      await createTodoAtPriority("Todo 1", 1);
      await createTodoAtPriority("Todo 2", 2);
      const id3 = await createTodoAtPriority("Todo 3", 3);

      await verifyNoGaps(); // Initial: [1,2,3]

      // Delete last todo
      await TodoService.deleteTodo(id3);

      await verifyNoGaps(); // Should be [1,2]

      const activeTodos = await TodoService.getActiveTodos();
      expect(activeTodos).toHaveLength(2);
    });

    test("should handle multiple deletions in sequence", async () => {
      const id1 = await createTodoAtPriority("Todo 1", 1);
      const _id2 = await createTodoAtPriority("Todo 2", 2);
      const id3 = await createTodoAtPriority("Todo 3", 3);
      const _id4 = await createTodoAtPriority("Todo 4", 4);
      const _id5 = await createTodoAtPriority("Todo 5", 5);

      await verifyNoGaps(); // Initial: [1,2,3,4,5]

      // Delete priority 3, then 1, then 4 (which becomes 3 after first deletion)
      await TodoService.deleteTodo(id3); // [1,2,3,4] (4,5 become 3,4)
      await verifyNoGaps();

      await TodoService.deleteTodo(id1); // [1,2,3] (2,3,4 become 1,2,3)
      await verifyNoGaps();

      // After first two deletions, id4 now has priority 3, id5 has priority 3
      // We need to get the current state to delete correctly
      const remainingTodos = await TodoService.getActiveTodos();
      const todoToDelete = remainingTodos.find((t) => t.title === "Todo 4");
      if (todoToDelete) {
        await TodoService.deleteTodo(todoToDelete.id); // [1,2]
        await verifyNoGaps();
      }

      const finalTodos = await TodoService.getActiveTodos();
      expect(finalTodos).toHaveLength(2);
    });
  });

  describe("Status Change Gap Closure", () => {
    test("should close gap when changing status from active to completed", async () => {
      await createTodoAtPriority("Todo 1", 1);
      const id2 = await createTodoAtPriority("Todo 2", 2);
      await createTodoAtPriority("Todo 3", 3);
      await createTodoAtPriority("Todo 4", 4);

      await verifyNoGaps(); // Initial: [1,2,3,4]

      // Change todo 2 to completed
      await TodoService.updateTodo(id2, { status: "completed" });

      await verifyNoGaps(); // Should be [1,2,3] (priorities 3,4 become 2,3)

      const activeTodos = await TodoService.getActiveTodos();
      expect(activeTodos).toHaveLength(3);

      const completedTodos = await TodoService.getCompletedTodos();
      expect(completedTodos).toHaveLength(1);
      expect(completedTodos[0].priority).toBeNull();
    });

    test("should close gap when changing status from active to archived", async () => {
      await createTodoAtPriority("Todo 1", 1);
      await createTodoAtPriority("Todo 2", 2);
      const id3 = await createTodoAtPriority("Todo 3", 3);
      await createTodoAtPriority("Todo 4", 4);
      await createTodoAtPriority("Todo 5", 5);

      await verifyNoGaps(); // Initial: [1,2,3,4,5]

      // Archive todo 3
      await TodoService.updateTodo(id3, { status: "archived" });

      await verifyNoGaps(); // Should be [1,2,3,4] (priorities 4,5 become 3,4)

      const activeTodos = await TodoService.getActiveTodos();
      expect(activeTodos).toHaveLength(4);

      const archivedTodos = await TodoService.getArchivedTodos();
      expect(archivedTodos).toHaveLength(1);
      expect(archivedTodos[0].priority).toBeNull();
    });

    test("should assign priority when changing from completed to active", async () => {
      // Create some active todos
      await createTodoAtPriority("Active 1", 1);
      await createTodoAtPriority("Active 2", 2);

      // Create a completed todo
      const completedTodo = await TodoService.createTodo({
        title: "To be reactivated",
        priority: 999, // This will be ignored since we'll complete it immediately
      });
      await TodoService.updateTodo(completedTodo.id, { status: "completed" });

      await verifyNoGaps(); // Active should be [1,2]

      // Reactivate at priority 2 (should bump existing priority 2 to 3)
      await TodoService.updateTodo(completedTodo.id, {
        status: "active",
        priority: 2,
      });

      await verifyNoGaps(); // Should be [1,2,3]

      const activeTodos = await TodoService.getActiveTodos();
      expect(activeTodos).toHaveLength(3);

      // Verify the reactivated todo is at priority 2
      const reactivatedTodo = activeTodos.find(
        (t) => t.title === "To be reactivated"
      );
      expect(reactivatedTodo?.priority).toBe(2);
    });
  });

  describe("Priority Reordering Gap Prevention", () => {
    test("should not create gaps when changing priority within active status", async () => {
      const id1 = await createTodoAtPriority("Todo 1", 1);
      await createTodoAtPriority("Todo 2", 2);
      await createTodoAtPriority("Todo 3", 3);
      await createTodoAtPriority("Todo 4", 4);

      await verifyNoGaps(); // Initial: [1,2,3,4]

      // Move todo 1 to priority 3 (should close gap at 1, bump 3,4 to 4,5, then place at 3)
      await TodoService.updateTodo(id1, { priority: 3 });

      await verifyNoGaps(); // Should be [1,2,3,4]

      const activeTodos = await TodoService.getActiveTodos();
      expect(activeTodos).toHaveLength(4);

      // Verify todo 1 is now at priority 3
      const movedTodo = activeTodos.find((t) => t.title === "Todo 1");
      expect(movedTodo?.priority).toBe(3);
    });

    test("should handle moving from end to beginning", async () => {
      await createTodoAtPriority("Todo 1", 1);
      await createTodoAtPriority("Todo 2", 2);
      await createTodoAtPriority("Todo 3", 3);
      const id4 = await createTodoAtPriority("Todo 4", 4);

      await verifyNoGaps(); // Initial: [1,2,3,4]

      // Move todo 4 to priority 1
      await TodoService.updateTodo(id4, { priority: 1 });

      await verifyNoGaps(); // Should be [1,2,3,4]

      const activeTodos = await TodoService.getActiveTodos();
      const movedTodo = activeTodos.find((t) => t.title === "Todo 4");
      expect(movedTodo?.priority).toBe(1);
    });
  });

  describe("Complex Sequences", () => {
    test("should maintain no gaps through complex mixed operations", async () => {
      // Initial setup: 5 active todos
      const _id1 = await createTodoAtPriority("Todo 1", 1);
      const _id2 = await createTodoAtPriority("Todo 2", 2);
      const id3 = await createTodoAtPriority("Todo 3", 3);
      const id4 = await createTodoAtPriority("Todo 4", 4);
      const id5 = await createTodoAtPriority("Todo 5", 5);

      await verifyNoGaps(); // [1,2,3,4,5]

      // Delete middle
      await TodoService.deleteTodo(id3);
      await verifyNoGaps(); // [1,2,3,4]

      // Add new at beginning
      const _newId = await createTodoAtPriority("New Todo", 1);
      await verifyNoGaps(); // [1,2,3,4,5]

      // Complete one
      await TodoService.updateTodo(id4, { status: "completed" });
      await verifyNoGaps(); // [1,2,3,4]

      // Move last to second
      await TodoService.updateTodo(id5, { priority: 2 });
      await verifyNoGaps(); // [1,2,3,4]

      // Reactivate completed at priority 3
      await TodoService.updateTodo(id4, { status: "active", priority: 3 });
      await verifyNoGaps(); // [1,2,3,4,5]

      const finalTodos = await TodoService.getActiveTodos();
      expect(finalTodos).toHaveLength(5);
    });

    test("should handle rapid create/delete sequences", async () => {
      // Create and delete in various orders
      const ids: number[] = [];

      // Burst create
      for (let i = 1; i <= 10; i++) {
        const id = await createTodoAtPriority(`Burst ${i}`, i);
        ids.push(id);
      }
      await verifyNoGaps(); // [1,2,3,4,5,6,7,8,9,10]

      // Delete every other one
      for (let i = 1; i < ids.length; i += 2) {
        await TodoService.deleteTodo(ids[i]);
        await verifyNoGaps();
      }

      const remainingTodos = await TodoService.getActiveTodos();
      expect(remainingTodos).toHaveLength(5);

      // Create new ones at random positions
      await createTodoAtPriority("Random 1", 3);
      await verifyNoGaps();

      await createTodoAtPriority("Random 2", 1);
      await verifyNoGaps();

      await createTodoAtPriority("Random 3", 7);
      await verifyNoGaps();

      const finalTodos = await TodoService.getActiveTodos();
      expect(finalTodos).toHaveLength(8);
    });
  });

  describe("Edge Cases", () => {
    test("should handle single todo operations", async () => {
      const id = await createTodoAtPriority("Only Todo", 1);
      await verifyNoGaps(); // [1]

      await TodoService.deleteTodo(id);
      await verifyNoGaps(); // []

      const todos = await TodoService.getActiveTodos();
      expect(todos).toHaveLength(0);
    });

    test("should handle creating at very high priority", async () => {
      await createTodoAtPriority("Todo 1", 1);
      await createTodoAtPriority("Todo 2", 2);

      // Create at priority 100 - should get normalized to 3
      await createTodoAtPriority("High Priority", 100);
      await verifyNoGaps(); // [1,2,3]

      const todos = await TodoService.getActiveTodos();
      expect(todos).toHaveLength(3);
    });

    test("should handle toggle operations maintaining gap-free state", async () => {
      const _id1 = await createTodoAtPriority("Todo 1", 1);
      const id2 = await createTodoAtPriority("Todo 2", 2);
      const _id3 = await createTodoAtPriority("Todo 3", 3);

      await verifyNoGaps(); // [1,2,3]

      // Toggle middle todo to completed
      await TodoService.toggleTodo(id2);
      await verifyNoGaps(); // [1,2] (todos 1,3 should be at priorities 1,2)

      // Toggle it back to active at priority 2
      await TodoService.toggleTodo(id2, 2);
      await verifyNoGaps(); // [1,2,3]

      const activeTodos = await TodoService.getActiveTodos();
      expect(activeTodos).toHaveLength(3);
    });

    test("should maintain gaps-free state after resequencing", async () => {
      // Manually create a scenario that might have gaps (though our system prevents them)
      await createTodoAtPriority("Todo 1", 1);
      await createTodoAtPriority("Todo 2", 2);
      await createTodoAtPriority("Todo 3", 3);

      await verifyNoGaps(); // [1,2,3]

      // Run the repair tool
      const result = await TodoService.resequenceActivePriorities();

      // Should report no gaps were found since our system maintains them
      expect(result.resequenced).toBe(false);
      expect(result.gaps).toBe(0);

      await verifyNoGaps(); // Still [1,2,3]
    });
  });
});
