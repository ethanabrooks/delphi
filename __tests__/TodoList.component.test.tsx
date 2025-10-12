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
  refetch: async () => {},
});

describe("TodoList Component - Tamagui Mock Tests", () => {
  beforeEach(() => {
    mockUseTodosManager.mockReturnValue(createHookReturn());
  });

  test("should render debug header and empty-state columns", async () => {
    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByText("Todo Debug Board")).toBeTruthy();
      expect(screen.getByText("Active (0)")).toBeTruthy();
      expect(screen.getByText("Completed (0)")).toBeTruthy();
      expect(screen.getByText("Archived (0)")).toBeTruthy();
      expect(screen.getByText("No active todos")).toBeTruthy();
      expect(screen.getByText("No completed todos")).toBeTruthy();
      expect(screen.getByText("No archived todos")).toBeTruthy();
    });
  });

  test("should render Tamagui Button and Input components with text content", async () => {
    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Add todo...")).toBeTruthy();
      expect(screen.getByTestId("add-todo-button")).toBeTruthy();
    });
  });

  test("disables the add button while loading", () => {
    const hookValue = createHookReturn();
    hookValue.isLoading = true;
    mockUseTodosManager.mockReturnValue(hookValue);

    render(<TodoList />);

    expect(screen.getByTestId("add-todo-button")).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: true })
    );
  });
});
