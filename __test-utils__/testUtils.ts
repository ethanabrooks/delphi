import type {
  CreateTodoInput,
  Todo,
  TodoStatus,
  UpdateTodoInput,
} from "../types/todo";
import {
  bumpTodosFromPriorityInMemory,
  getNextHighestPriority,
} from "../utils/priorityUtils";

// In-memory test database
let testTodos: Todo[] = [];
let _nextPriority = 1;

export const resetTestData = () => {
  testTodos = [];
  _nextPriority = 1;
};

// Single shared instance for consistent test data
const sharedTestTodoService = {
  async getAllTodos(): Promise<Todo[]> {
    return [...testTodos].sort((a, b) => a.priority - b.priority);
  },

  async getTodoByIdentifier(
    priority: number,
    status: TodoStatus
  ): Promise<Todo | null> {
    return (
      testTodos.find(
        (todo) => todo.priority === priority && todo.status === status
      ) || null
    );
  },

  async createTodo(input: CreateTodoInput): Promise<Todo> {
    const now = new Date().toISOString();
    let targetPriority: number;

    if (input.priority !== undefined) {
      targetPriority = input.priority;
      // Bump existing todos with same or higher priority within active status
      bumpTodosFromPriorityInMemory(testTodos, targetPriority, "active", now);
    } else {
      // Assign highest priority (lowest number) within active status
      targetPriority = getNextHighestPriority(testTodos, "active");
    }

    const newTodo: Todo = {
      priority: targetPriority,
      title: input.title,
      description: input.description,
      status: "active",
      due_date: input.due_date,
      created_at: now,
      updated_at: now,
    };
    testTodos.push(newTodo);
    return newTodo;
  },

  async updateTodo(input: UpdateTodoInput): Promise<Todo | null> {
    const index = testTodos.findIndex(
      (todo) => todo.priority === input.priority && todo.status === input.status
    );
    if (index === -1) return null;

    const currentTodo = testTodos[index];
    const now = new Date().toISOString();

    const newPriority = input.newPriority ?? input.priority;
    const newStatus = input.newStatus ?? input.status;

    // Check if we're changing the priority or status
    if (
      (input.newPriority !== undefined &&
        input.newPriority !== input.priority) ||
      (input.newStatus !== undefined && input.newStatus !== input.status)
    ) {
      // We're changing priority or status - handle bumping in target status
      if (
        input.newPriority !== undefined &&
        input.newPriority !== input.priority
      ) {
        bumpTodosFromPriorityInMemory(testTodos, newPriority, newStatus, now);
      }

      // Update the todo with new priority/status and other fields
      const updatedTodo = {
        ...currentTodo,
        priority: newPriority,
        status: newStatus,
        title: input.title ?? currentTodo.title,
        description: input.description ?? currentTodo.description,
        due_date: input.due_date ?? currentTodo.due_date,
        updated_at: now,
      };
      testTodos[index] = updatedTodo;
      return updatedTodo;
    } else {
      // Not changing priority or status - just update other fields
      const updatedTodo = {
        ...currentTodo,
        title: input.title ?? currentTodo.title,
        description: input.description ?? currentTodo.description,
        due_date: input.due_date ?? currentTodo.due_date,
        updated_at: now,
      };
      testTodos[index] = updatedTodo;
      return updatedTodo;
    }
  },

  async deleteTodo(priority: number, status: TodoStatus): Promise<boolean> {
    const initialLength = testTodos.length;
    testTodos = testTodos.filter(
      (todo) => !(todo.priority === priority && todo.status === status)
    );
    return testTodos.length < initialLength;
  },

  async toggleTodo(priority: number, status: TodoStatus): Promise<Todo | null> {
    const todo = testTodos.find(
      (t) => t.priority === priority && t.status === status
    );
    if (!todo) return null;

    const newStatus: TodoStatus =
      todo.status === "completed" ? "active" : "completed";
    return this.updateTodo({
      priority,
      status,
      newStatus,
    });
  },

  async getActiveTodos(): Promise<Todo[]> {
    return testTodos
      .filter((todo) => todo.status === "active")
      .sort((a, b) => a.priority - b.priority);
  },

  async getCompletedTodos(): Promise<Todo[]> {
    return testTodos
      .filter((todo) => todo.status === "completed")
      .sort((a, b) => a.priority - b.priority);
  },

  async getArchivedTodos(): Promise<Todo[]> {
    return testTodos
      .filter((todo) => todo.status === "archived")
      .sort((a, b) => a.priority - b.priority);
  },

  async getTodosByStatus(status: string): Promise<Todo[]> {
    return testTodos
      .filter((todo) => todo.status === status)
      .sort((a, b) => a.priority - b.priority);
  },

  async clearAllTodos(): Promise<void> {
    testTodos = [];
  },

  async getTodoStats() {
    const total = testTodos.length;
    const active = testTodos.filter((t) => t.status === "active").length;
    const completed = testTodos.filter((t) => t.status === "completed").length;
    const archived = testTodos.filter((t) => t.status === "archived").length;

    return { total, active, completed, archived };
  },
};

// Mock TodoService that uses in-memory data but has same interface
export const createTestTodoService = () => sharedTestTodoService;

export const mockTodoServiceForTesting = () => {
  return {
    TodoService: sharedTestTodoService,
  };
};
