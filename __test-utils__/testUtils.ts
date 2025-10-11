import type { CreateTodoInput, Todo, UpdateTodoInput } from "../types/todo";

// In-memory test database
let testTodos: Todo[] = [];
let nextId = 1;

export const resetTestData = () => {
  testTodos = [];
  nextId = 1;
};

// Mock TodoService that uses in-memory data but has same interface
export const createTestTodoService = () => ({
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
      completed: false,
      priority: input.priority || 1,
      category: input.category,
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

    return this.updateTodo({
      id,
      completed: !todo.completed,
    });
  },

  async getIncompleteTodos(): Promise<Todo[]> {
    return testTodos
      .filter((todo) => !todo.completed)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  async getCompletedTodos(): Promise<Todo[]> {
    return testTodos
      .filter((todo) => todo.completed)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  async getTodosByPriority(priority: number): Promise<Todo[]> {
    return testTodos
      .filter((todo) => todo.priority === priority)
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
    const completed = testTodos.filter((t) => t.completed).length;
    const pending = total - completed;
    const highPriority = testTodos.filter(
      (t) => t.priority === 3 && !t.completed
    ).length;

    return { total, completed, pending, highPriority };
  },
});

export const mockTodoServiceForTesting = () => {
  const testService = createTestTodoService();
  return {
    TodoService: testService,
  };
};
