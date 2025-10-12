import type { CreateTodoInput, Todo, UpdateTodoInput } from "../types/todo";

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

  async getTodoByPriority(priority: number): Promise<Todo | null> {
    return testTodos.find((todo) => todo.priority === priority) || null;
  },

  async createTodo(input: CreateTodoInput): Promise<Todo> {
    const now = new Date().toISOString();
    let targetPriority: number;

    if (input.priority !== undefined) {
      targetPriority = input.priority;
      // Bump existing todos with same or higher priority
      testTodos.forEach((todo) => {
        if (todo.priority >= targetPriority) {
          todo.priority += 1;
          todo.updated_at = now;
        }
      });
    } else {
      // Assign highest priority (lowest number)
      targetPriority =
        testTodos.length > 0
          ? Math.min(...testTodos.map((t) => t.priority)) - 1
          : 1;
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
      (todo) => todo.priority === input.priority
    );
    if (index === -1) return null;

    const updatedTodo = {
      ...testTodos[index],
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.due_date !== undefined && { due_date: input.due_date }),
      updated_at: new Date().toISOString(),
    };
    testTodos[index] = updatedTodo;
    return updatedTodo;
  },

  async deleteTodo(priority: number): Promise<boolean> {
    const initialLength = testTodos.length;
    testTodos = testTodos.filter((todo) => todo.priority !== priority);
    return testTodos.length < initialLength;
  },

  async toggleTodo(priority: number): Promise<Todo | null> {
    const todo = testTodos.find((t) => t.priority === priority);
    if (!todo) return null;

    const newStatus = todo.status === "completed" ? "active" : "completed";
    return this.updateTodo({
      priority,
      status: newStatus,
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
