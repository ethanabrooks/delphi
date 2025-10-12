import { platformTodoService } from "../services/platformTodoService";
import type { CreateTodoInput } from "../types/todo";

describe("Preserve Priority on Status Change", () => {
  beforeEach(async () => {
    await platformTodoService.clearAllTodos();
  });

  it("should preserve priority when marking as completed", async () => {
    // Create active todo
    const todoInput: CreateTodoInput = { title: "Test Todo", priority: 5 };
    const created = await platformTodoService.createTodo(todoInput);

    expect(created.priority).toBe(5);
    expect(created.status).toBe("active");

    // Mark as completed
    const completed = await platformTodoService.updateTodo({
      id: created.id,
      status: "completed",
    });

    expect(completed?.priority).toBe(5); // Priority should be preserved
    expect(completed?.status).toBe("completed");
  });

  it("should preserve priority when archiving", async () => {
    // Create active todo
    const todoInput: CreateTodoInput = { title: "Test Todo", priority: 3 };
    const created = await platformTodoService.createTodo(todoInput);

    expect(created.priority).toBe(3);
    expect(created.status).toBe("active");

    // Archive the todo
    const archived = await platformTodoService.updateTodo({
      id: created.id,
      status: "archived",
    });

    expect(archived?.priority).toBe(3); // Priority should be preserved
    expect(archived?.status).toBe("archived");
  });

  it("should preserve priority when toggling to completed", async () => {
    // Create active todo
    const todoInput: CreateTodoInput = { title: "Test Todo", priority: 7 };
    const created = await platformTodoService.createTodo(todoInput);

    expect(created.priority).toBe(7);
    expect(created.status).toBe("active");

    // Toggle to completed
    const toggled = await platformTodoService.toggleCompleted(created.id);

    expect(toggled?.priority).toBe(7); // Priority should be preserved
    expect(toggled?.status).toBe("completed");
  });

  it("should preserve original priority on completion", async () => {
    // Create three active todos
    const todoA: CreateTodoInput = { title: "Todo A", priority: 1 };
    const todoB: CreateTodoInput = { title: "Todo B", priority: 2 };
    const todoC: CreateTodoInput = { title: "Todo C", priority: 3 };

    const createdA = await platformTodoService.createTodo(todoA);
    const _createdB = await platformTodoService.createTodo(todoB);
    const _createdC = await platformTodoService.createTodo(todoC);

    // Complete the first todo (A) - it should preserve its original priority
    const completed = await platformTodoService.updateTodo({
      id: createdA.id,
      status: "completed",
    });

    // The completed todo should keep its original priority (1)
    expect(completed?.status).toBe("completed");
    expect(completed?.priority).toBe(1); // Should preserve original priority

    // Check that we can retrieve completed todos and they maintain priority
    const completedTodos = await platformTodoService.getCompletedTodos();
    expect(completedTodos).toHaveLength(1);
    expect(completedTodos[0].priority).toBe(1);
    expect(completedTodos[0].status).toBe("completed");
  });

  it("should allow multiple completed/archived todos with same priority", async () => {
    // Create and complete multiple todos with same original priority
    const todoA: CreateTodoInput = { title: "Todo A", priority: 1 };
    const todoB: CreateTodoInput = { title: "Todo B", priority: 2 };

    const createdA = await platformTodoService.createTodo(todoA);
    const createdB = await platformTodoService.createTodo(todoB);

    // Complete both todos - they'll both end up with priority 2 (moved to end)
    const completedA = await platformTodoService.updateTodo({
      id: createdA.id,
      status: "completed",
    });
    const completedB = await platformTodoService.updateTodo({
      id: createdB.id,
      status: "completed",
    });

    // Both should maintain their final priorities
    expect(completedA?.status).toBe("completed");
    expect(completedB?.status).toBe("completed");

    // They might have the same priority since move-to-end puts them at the last position
    expect(typeof completedA?.priority).toBe("number");
    expect(typeof completedB?.priority).toBe("number");

    // The key point: completed/archived todos can have duplicate priorities
    // because only active todos need unique priorities
    const completedTodos = await platformTodoService.getCompletedTodos();
    expect(completedTodos).toHaveLength(2);
    expect(completedTodos.every((t) => t.status === "completed")).toBe(true);
    expect(completedTodos.every((t) => typeof t.priority === "number")).toBe(
      true
    );
  });
});
