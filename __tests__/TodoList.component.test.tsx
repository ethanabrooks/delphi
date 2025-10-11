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
  stats: { total: 0, completed: 0, pending: 0, highPriority: 0 },
  isLoading: false,
  error: null,
  lastMutation: null,
  addTodo: async () => {},
  updateTodo: async () => {},
  toggleTodo: async () => {},
  deleteTodo: async () => {},
  refetch: async () => {},
});

describe("TodoList Component - Tamagui Mock Tests", () => {
  beforeEach(() => {
    mockUseTodosManager.mockReturnValue(createHookReturn());
  });

  test("should render basic UI components correctly", async () => {
    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByText("My Todo List")).toBeTruthy();
      expect(screen.getByText("No todos yet! Add one above.")).toBeTruthy();
    });
  });

  test("should render Tamagui Button and Input components with text content", async () => {
    render(<TodoList />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("What needs to be done?")
      ).toBeTruthy();
      expect(screen.getByText("Priority:")).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByTestId("priority-1-button")).toBeTruthy();
      expect(screen.getByTestId("priority-2-button")).toBeTruthy();
      expect(screen.getByTestId("priority-3-button")).toBeTruthy();
      expect(screen.getByTestId("add-todo-button")).toBeTruthy();
    });
  });

  test("should show loading state correctly", () => {
    const hookValue = createHookReturn();
    hookValue.isLoading = true;
    mockUseTodosManager.mockReturnValue(hookValue);

    render(<TodoList />);

    expect(screen.getByText("Loading...")).toBeTruthy();
  });
});
