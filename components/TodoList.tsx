import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { Button, Card, Input, ScrollView, Text, XStack, YStack } from "tamagui";
import useTodosManager from "../hooks/useTodosManager";
import type { Todo } from "../types/todo";
import { getNextHighestPriority } from "../utils/priorityUtils";

// Removed all styled components - using Tamagui components directly

export default function TodoList() {
  const [newTodo, setNewTodo] = useState("");
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const {
    todos,
    stats,
    isLoading,
    error,
    addTodo,
    updateTodo,
    toggleTodo,
    refetch,
  } = useTodosManager();

  // Debug function to clear all todos
  const clearAllTodos = async () => {
    if (window.confirm("Delete all todos? This cannot be undone.")) {
      localStorage.removeItem("delphi_todos");
      await refetch();
    }
  };
  const { total, active, completed, archived } = stats;

  // Memoized status buckets
  const todosByStatus = useMemo(() => {
    const activeTodos = todos
      .filter((todo) => todo.status === "active")
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const completedTodos = todos.filter((todo) => todo.status === "completed");
    const archivedTodos = todos.filter((todo) => todo.status === "archived");
    return { activeTodos, completedTodos, archivedTodos };
  }, [todos]);

  const handleAddTodo = useCallback(async () => {
    if (!newTodo.trim()) {
      Alert.alert("Error", "Please enter a todo item");
      return;
    }

    // Calculate the next highest priority (lowest number available) for active todos
    const priority = getNextHighestPriority(todos, "active");

    await addTodo({
      title: newTodo.trim(),
      priority,
    });

    setNewTodo("");
  }, [addTodo, newTodo, todos]);

  const handleToggleTodo = useCallback(
    async (todo: Todo) => {
      const identifier =
        todo.status === "active" && todo.priority !== null
          ? todo.priority
          : todo.id;
      await toggleTodo(identifier, todo.status);
    },
    [toggleTodo]
  );

  const handleMoveTodo = useCallback(
    async (todo: Todo, direction: "up" | "down") => {
      if (todo.status !== "active" || todo.priority === null) return;

      // Simple increment/decrement approach (0-based)
      const newPriority =
        direction === "up"
          ? Math.max(1, todo.priority - 1) // Move up = lower priority number (min 1)
          : todo.priority + 1; // Move down = higher priority number

      // Update the todo's priority in the database
      await updateTodo({
        id: todo.id,
        priority: newPriority,
      });

      // Refetch all todos from the database to get the updated order
      await refetch();
    },
    [refetch, updateTodo]
  );

  const handleArchiveTodo = useCallback(
    async (todo: Todo) => {
      if (todo.status !== "active") return;

      await updateTodo({
        id: todo.id,
        status: "archived",
      });
    },
    [updateTodo]
  );

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const { activeTodos } = todosByStatus;
      if (activeTodos.length === 0) return;

      const selectedTodo = activeTodos.find(
        (t) => t.priority === selectedTodoId
      );
      const currentIndex = selectedTodo
        ? activeTodos.findIndex((t) => t.priority === selectedTodoId)
        : 0;

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          if (selectedTodo && currentIndex > 0) {
            void handleMoveTodo(selectedTodo, "up");
          } else {
            const prevIndex = Math.max(0, currentIndex - 1);
            setSelectedTodoId(activeTodos[prevIndex]?.priority ?? null);
          }
          break;
        case "ArrowDown":
          event.preventDefault();
          if (selectedTodo && currentIndex < activeTodos.length - 1) {
            void handleMoveTodo(selectedTodo, "down");
          } else {
            const nextIndex = Math.min(
              activeTodos.length - 1,
              currentIndex + 1
            );
            setSelectedTodoId(activeTodos[nextIndex]?.priority ?? null);
          }
          break;
        case "Enter":
          event.preventDefault();
          if (selectedTodo) {
            void handleToggleTodo(selectedTodo);
          }
          break;
        case "Delete":
        case "Backspace":
          event.preventDefault();
          if (selectedTodo) {
            void handleArchiveTodo(selectedTodo);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleArchiveTodo,
    handleMoveTodo,
    handleToggleTodo,
    selectedTodoId,
    todosByStatus,
  ]);

  const { activeTodos, completedTodos, archivedTodos } = todosByStatus;

  return (
    <YStack flex={1} padding="$4">
      <XStack
        justifyContent="space-between"
        alignItems="center"
        marginBottom="$4"
      >
        <Text
          fontSize="$6"
          fontWeight="bold"
          color="$gray12"
          flex={1}
          textAlign="center"
        >
          Todo Debug Board
        </Text>
        <Button size="$3" theme="red" onPress={clearAllTodos}>
          Clear All
        </Button>
      </XStack>

      {/* Error display */}
      {error && (
        <Card backgroundColor="$red3" padding="$2" marginBottom="$3">
          <Text color="$red11" textAlign="center" fontSize="$3">
            {error}
          </Text>
        </Card>
      )}

      {/* Stats */}
      <Card backgroundColor="$gray3" padding="$2" marginBottom="$3">
        <Text textAlign="center" color="$gray11" fontSize="$3">
          {active} active, {completed} completed, {archived} archived ({total}{" "}
          total)
        </Text>
      </Card>

      {/* Keyboard shortcuts */}
      <Card backgroundColor="$gray2" padding="$2" marginBottom="$3">
        <Text textAlign="center" color="$gray10" fontSize="$2">
          💡 Enter: Add todo | ↑↓: Move/Select | Enter: Toggle | Del: Archive
        </Text>
      </Card>

      {/* Three column layout */}
      <XStack flex={1} gap="$3">
        {/* Active Column */}
        <YStack
          flex={1}
          backgroundColor="$gray2"
          padding="$3"
          borderRadius="$3"
        >
          <Text fontSize="$4" fontWeight="bold" marginBottom="$3">
            Active ({active})
          </Text>

          {/* Add new todo form */}
          <XStack marginBottom="$3" gap="$2">
            <Input
              value={newTodo}
              onChangeText={setNewTodo}
              onSubmitEditing={handleAddTodo}
              placeholder="Add todo..."
              flex={1}
              size="$3"
              testID="todo-input"
            />
            <Button
              onPress={handleAddTodo}
              disabled={isLoading}
              size="$3"
              testID="add-todo-button"
            >
              +
            </Button>
          </XStack>

          <ScrollView flex={1}>
            {activeTodos.map((todo, index) => (
              <Card
                key={todo.id}
                padding="$2"
                marginBottom="$2"
                backgroundColor={
                  selectedTodoId === todo.priority ? "$blue3" : "$background"
                }
                borderColor={
                  selectedTodoId === todo.priority ? "$blue8" : "transparent"
                }
                borderWidth={1}
                onPress={() => setSelectedTodoId(todo.priority)}
                cursor="pointer"
              >
                <YStack>
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="$3" flex={1} marginRight="$2">
                      #{todo.priority} {todo.title}
                    </Text>
                    <XStack gap="$1">
                      <Button
                        size="$2"
                        disabled={todo.priority === 1}
                        onPress={() => {
                          void handleMoveTodo(todo, "up");
                        }}
                      >
                        ↑
                      </Button>
                      <Button
                        size="$2"
                        disabled={index === activeTodos.length - 1}
                        onPress={() => {
                          void handleMoveTodo(todo, "down");
                        }}
                      >
                        ↓
                      </Button>
                    </XStack>
                  </XStack>
                  <XStack marginTop="$1" gap="$1">
                    <Button
                      size="$2"
                      theme="green"
                      onPress={() => handleToggleTodo(todo)}
                    >
                      Done
                    </Button>
                    <Button
                      size="$2"
                      theme="orange"
                      onPress={() => handleArchiveTodo(todo)}
                    >
                      Archive
                    </Button>
                  </XStack>
                </YStack>
              </Card>
            ))}
            {activeTodos.length === 0 && (
              <Text
                color="$gray10"
                textAlign="center"
                fontSize="$3"
                marginTop="$4"
              >
                No active todos
              </Text>
            )}
          </ScrollView>
        </YStack>

        {/* Completed Column */}
        <YStack
          flex={1}
          backgroundColor="$green2"
          padding="$3"
          borderRadius="$3"
        >
          <Text fontSize="$4" fontWeight="bold" marginBottom="$3">
            Completed ({completed})
          </Text>

          <ScrollView flex={1}>
            {completedTodos.map((todo) => (
              <Card
                key={todo.id}
                padding="$2"
                marginBottom="$2"
                backgroundColor="$background"
                opacity={0.7}
              >
                <YStack>
                  <Text
                    fontSize="$3"
                    textDecorationLine="line-through"
                    marginBottom="$1"
                  >
                    {todo.title}
                  </Text>
                  <XStack gap="$1">
                    <Button
                      size="$2"
                      theme="yellow"
                      onPress={() => handleToggleTodo(todo)}
                    >
                      Undo
                    </Button>
                  </XStack>
                </YStack>
              </Card>
            ))}
            {completedTodos.length === 0 && (
              <Text
                color="$gray10"
                textAlign="center"
                fontSize="$3"
                marginTop="$4"
              >
                No completed todos
              </Text>
            )}
          </ScrollView>
        </YStack>

        {/* Archived Column */}
        <YStack
          flex={1}
          backgroundColor="$gray4"
          padding="$3"
          borderRadius="$3"
        >
          <Text fontSize="$4" fontWeight="bold" marginBottom="$3">
            Archived ({archived})
          </Text>

          <ScrollView flex={1}>
            {archivedTodos.map((todo) => (
              <Card
                key={todo.id}
                padding="$2"
                marginBottom="$2"
                backgroundColor="$background"
                opacity={0.5}
              >
                <YStack>
                  <Text fontSize="$3" color="$gray10" marginBottom="$1">
                    {todo.title}
                  </Text>
                  <XStack gap="$1">
                    <Button
                      size="$2"
                      theme="blue"
                      onPress={() => handleToggleTodo(todo)}
                    >
                      Undo
                    </Button>
                  </XStack>
                </YStack>
              </Card>
            ))}
            {archivedTodos.length === 0 && (
              <Text
                color="$gray10"
                textAlign="center"
                fontSize="$3"
                marginTop="$4"
              >
                No archived todos
              </Text>
            )}
          </ScrollView>
        </YStack>
      </XStack>
    </YStack>
  );
}
