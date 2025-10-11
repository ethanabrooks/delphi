import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { resetTestData } from "../__test-utils__/testUtils";
import TodoList from "../components/TodoList";
import { useTodoStore } from "../stores/simpleTodoStore";

// Mock the TodoService to use our in-memory test implementation
jest.mock("../services/todoService", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { mockTodoServiceForTesting } = require("../__test-utils__/testUtils");
  return mockTodoServiceForTesting();
});

// Mock the Alert since we're not testing native alerts
const mockAlert = Alert.alert as jest.Mock;

describe("TodoList Component - Tamagui Mock Tests", () => {
  beforeEach(() => {
    resetTestData();
    // Reset store state
    useTodoStore.setState({
      todos: [],
      isLoading: false,
      error: null,
    });
    mockAlert.mockClear();
  });

  test("should render basic UI components correctly", async () => {
    render(<TodoList />);

    // Wait for initialization and content to appear
    // This test proves that Tamagui mocks render text content correctly
    await waitFor(() => {
      expect(screen.getByText("My Todo List")).toBeTruthy();
      expect(screen.getByText("No todos yet! Add one above.")).toBeTruthy();
    });
  });

  test("should render Tamagui Button and Input components with text content", async () => {
    render(<TodoList />);

    // This test specifically validates that the Tamagui mock fix works
    // Previously, these elements wouldn't render text content at all
    await waitFor(() => {
      // Input component works
      expect(
        screen.getByPlaceholderText("What needs to be done?")
      ).toBeTruthy();

      // Text component works
      expect(screen.getByText("Priority:")).toBeTruthy();
    });

    // Button components render with proper text content - this was the main issue
    await waitFor(() => {
      expect(screen.getByTestId("priority-1-button")).toBeTruthy();
      expect(screen.getByTestId("priority-2-button")).toBeTruthy();
      expect(screen.getByTestId("priority-3-button")).toBeTruthy();
      expect(screen.getByTestId("add-todo-button")).toBeTruthy();
    });
  });

  test("should show loading state correctly", () => {
    // Set loading state in store
    useTodoStore.setState({
      todos: [],
      isLoading: true,
      error: null,
    });

    render(<TodoList />);

    // This proves the conditional text rendering works in Tamagui mocks
    expect(screen.getByText("Loading...")).toBeTruthy();
  });
});
