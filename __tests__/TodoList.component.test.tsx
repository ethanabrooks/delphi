import { beforeEach, describe, expect, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import TodoList from "../components/TodoList";
import type { UseTodosManagerResult } from "../hooks/useTodosManager";
import useTodosManager from "../hooks/useTodosManager";

jest.mock("../hooks/useTodosManager");

const mockUseTodosManager = useTodosManager as jest.MockedFunction<
  typeof useTodosManager
>;

const createHookReturn = (): UseTodosManagerResult => ({
  todos: [],
  stats: { total: 0, active: 0, completed: 0, archived: 0 },
  isLoading: false,
  error: null,
  lastMutation: null,
  addTodo: async () => {},
  updateTodo: async () => {},
  toggleCompleted: async () => {},
  toggleArchived: async () => {},
  deleteTodo: async () => {},
  reorderTodo: async () => {},
  refetch: async () => {},
});

describe("TodoList Component - Tamagui Mock Tests", () => {
  beforeEach(() => {
    mockUseTodosManager.mockReturnValue(createHookReturn());
  });

  test("should render empty state with input", async () => {
    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Capture a task...")).toBeTruthy();
      expect(screen.getByText("Tasks")).toBeTruthy();
    });
  });

  test("should render Input component with correct placeholder", async () => {
    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Capture a task...")).toBeTruthy();
      expect(screen.getByTestId("todo-input")).toBeTruthy();
    });
  });

  test("renders input when loading", () => {
    const hookValue = createHookReturn();
    hookValue.isLoading = true;
    mockUseTodosManager.mockReturnValue(hookValue);

    render(<TodoList />);

    // Input is always available regardless of loading state
    expect(screen.getByTestId("todo-input")).toBeTruthy();
  });
});
