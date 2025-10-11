import { render, waitFor } from "@testing-library/react-native";
import React from "react";
import TodoList from "../components/TodoList";
import { TodoService } from "../services/todoService";
import type { Todo } from "../types/todo";

// Mock the TodoService
jest.mock("../services/todoService");
const mockedTodoService = TodoService as jest.Mocked<typeof TodoService>;

// Mock the database initialization
jest.mock("../db/database", () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  db: jest.fn().mockResolvedValue({}),
  mapTodoRowToTodo: jest.fn((row) => row),
}));

describe("TodoList Integration Test", () => {
  const mockTodo: Todo = {
    id: 1,
    title: "Test Todo",
    description: "Test Description",
    completed: false,
    priority: 2,
    category: "Work",
    created_at: "2023-10-11T12:00:00Z",
    updated_at: "2023-10-11T12:00:00Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Simple default: empty todos
    mockedTodoService.getAllTodos.mockResolvedValue([]);
  });

  test("should render and integrate with TodoService", async () => {
    const { getByText } = render(<TodoList />);

    // Basic render check
    await waitFor(() => {
      expect(getByText("My Todo List")).toBeDefined();
    });

    // Verify service integration
    expect(mockedTodoService.getAllTodos).toHaveBeenCalled();
  });

  test("should handle empty state", async () => {
    const { getByText } = render(<TodoList />);

    await waitFor(() => {
      expect(getByText("No todos yet! Add one above.")).toBeDefined();
    });
  });

  test("should display todos when they exist", async () => {
    mockedTodoService.getAllTodos.mockResolvedValue([mockTodo]);

    const { getByText } = render(<TodoList />);

    await waitFor(() => {
      expect(getByText("Test Todo")).toBeDefined();
    });
  });
});
