import type { CreateTodoInput, Todo, UpdateTodoInput } from "../types/todo";

// In-memory test database
let testTodos: Todo[] = [];
let nextId = 1;

export const resetTestData = () => {
  testTodos = [];
  nextId = 1;
};

// Single shared instance for consistent test data
const sharedTestTodoService = {
  async getAllTodos(): Promise<Todo[]> {
    return [...testTodos].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getTodoById(id: number): Promise<Todo | null> {
    return testTodos.find((todo) => todo.id === id) || null;
  },

  async createTodo(input: CreateTodoInput): Promise<Todo> {
    const now = new Date().toISOString();
    const newTodo: Todo = {
      id: nextId++,
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
    const index = testTodos.findIndex((todo) => todo.id === input.id);
    if (index === -1) return null;

    const updatedTodo = {
      ...testTodos[index],
      ...input,
      updated_at: new Date().toISOString(),
    };
    testTodos[index] = updatedTodo;
    return updatedTodo;
  },

  async deleteTodo(id: number): Promise<boolean> {
    const initialLength = testTodos.length;
    testTodos = testTodos.filter((todo) => todo.id !== id);
    return testTodos.length < initialLength;
  },

  async toggleTodo(id: number): Promise<Todo | null> {
    const todo = testTodos.find((t) => t.id === id);
    if (!todo) return null;

    const newStatus = todo.status === "completed" ? "active" : "completed";
    return this.updateTodo({
      id,
      status: newStatus,
    });
  },

  async getActiveTodos(): Promise<Todo[]> {
    return testTodos
      .filter((todo) => todo.status === "active")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  async getCompletedTodos(): Promise<Todo[]> {
    return testTodos
      .filter((todo) => todo.status === "completed")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  async getArchivedTodos(): Promise<Todo[]> {
    return testTodos
      .filter((todo) => todo.status === "archived")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  async getTodosByStatus(status: string): Promise<Todo[]> {
    return testTodos
      .filter((todo) => todo.status === status)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
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
