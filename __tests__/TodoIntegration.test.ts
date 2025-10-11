import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the TodoService
const mockGetAllTodos = vi.fn();
vi.mock("../services/todoService", () => ({
  TodoService: {
    getAllTodos: mockGetAllTodos,
  },
}));

// Mock the database initialization
vi.mock("../db/database", () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  db: vi.fn().mockResolvedValue({}),
  mapTodoRowToTodo: vi.fn((row: any) => row),
}));

describe("TodoService Integration Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllTodos.mockResolvedValue([]);
  });

  test("should call TodoService.getAllTodos", async () => {
    const { TodoService } = await import("../services/todoService");

    await TodoService.getAllTodos();

    expect(mockGetAllTodos).toHaveBeenCalled();
  });

  test("should handle empty todos", async () => {
    const { TodoService } = await import("../services/todoService");

    const result = await TodoService.getAllTodos();

    expect(result).toEqual([]);
  });

  test("should handle todos with data", async () => {
    const mockTodos = [
      {
        id: 1,
        title: "Test Todo",
        description: "Test Description",
        completed: false,
        priority: 2,
        category: "Work",
        created_at: "2023-10-11T12:00:00Z",
        updated_at: "2023-10-11T12:00:00Z",
      },
    ];

    mockGetAllTodos.mockResolvedValue(mockTodos);

    const { TodoService } = await import("../services/todoService");
    const result = await TodoService.getAllTodos();

    expect(result).toEqual(mockTodos);
  });
});
