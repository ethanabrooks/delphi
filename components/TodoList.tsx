import { useState } from "react";
import { Alert } from "react-native";
import { Button, Card, Input, ScrollView, Text, XStack, YStack } from "tamagui";
import useTodosManager from "../hooks/useTodosManager";
import { STATUS_LABELS } from "../types/todo";
import { getNextHighestPriority } from "../utils/priorityUtils";

// Removed all styled components - using Tamagui components directly

export default function TodoList() {
  const [newTodo, setNewTodo] = useState("");
  const { todos, stats, isLoading, error, addTodo, toggleTodo, deleteTodo } =
    useTodosManager();
  const { total, active, completed, archived } = stats;

  const handleAddTodo = async () => {
    if (!newTodo.trim()) {
      Alert.alert("Error", "Please enter a todo item");
      return;
    }

    // Calculate the next highest priority (lowest number available)
    const priority = getNextHighestPriority(todos);

    await addTodo({
      title: newTodo.trim(),
      priority,
    });

    setNewTodo("");
  };

  const handleToggleTodo = async (todoPriority: number) => {
    await toggleTodo(todoPriority);
  };

  const handleDeleteTodo = (todoPriority: number, title: string) => {
    Alert.alert("Delete Todo", `Are you sure you want to delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTodo(todoPriority);
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <YStack flex={1} padding="$4">
      <Text
        fontSize="$7"
        fontWeight="bold"
        color="$gray12"
        marginBottom="$6"
        textAlign="center"
      >
        My Todo List
      </Text>

      {/* Error display */}
      {error && (
        <Card backgroundColor="$red3" padding="$3" marginBottom="$4">
          <Text color="$red11" textAlign="center">
            {error}
          </Text>
        </Card>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <Card backgroundColor="$blue3" padding="$3" marginBottom="$4">
          <Text color="$blue11" textAlign="center">
            Loading...
          </Text>
        </Card>
      )}

      {/* Add new todo */}
      <Card
        backgroundColor="$background"
        padding="$4"
        marginBottom="$4"
        elevate
      >
        <Input
          value={newTodo}
          onChangeText={setNewTodo}
          placeholder="What needs to be done?"
          borderWidth={1}
          borderColor="$gray7"
          borderRadius="$4"
          padding="$3"
          marginBottom="$3"
          multiline
          testID="todo-input"
        />

        <Button
          onPress={handleAddTodo}
          disabled={isLoading}
          theme="blue"
          size="$4"
          borderRadius="$4"
          testID="add-todo-button"
        >
          {isLoading ? "Adding..." : "Add Todo"}
        </Button>
      </Card>

      {/* Todo list */}
      <ScrollView flex={1}>
        {todos.length === 0 ? (
          <Card backgroundColor="$gray2" padding="$8">
            <Text color="$gray10" textAlign="center" fontSize="$5">
              No todos yet! Add one above.
            </Text>
          </Card>
        ) : (
          todos.map((todo) => (
            <Card
              key={todo.priority}
              backgroundColor="$background"
              padding="$4"
              marginBottom="$3"
              opacity={todo.status === "completed" ? 0.6 : 1}
              elevate
            >
              <XStack justifyContent="space-between" alignItems="flex-start">
                <YStack flex={1} marginRight="$3">
                  <Button
                    onPress={() => handleToggleTodo(todo.priority)}
                    unstyled
                    pressStyle={{ opacity: 0.7 }}
                  >
                    <Text
                      fontSize="$5"
                      fontWeight="500"
                      textDecorationLine={
                        todo.status === "completed" ? "line-through" : "none"
                      }
                      color={
                        todo.status === "completed" ? "$gray10" : "$gray12"
                      }
                    >
                      {todo.title}
                    </Text>
                  </Button>

                  {todo.description && (
                    <Text color="$gray11" marginTop="$1">
                      {todo.description}
                    </Text>
                  )}

                  <XStack alignItems="center" marginTop="$2">
                    <Button
                      theme="blue"
                      size="$1"
                      borderRadius="$10"
                      marginRight="$2"
                      disabled
                    >
                      {STATUS_LABELS[todo.status]}
                    </Button>

                    <Text fontSize="$2" color="$gray10">
                      {formatDate(todo.created_at)}
                    </Text>
                  </XStack>
                </YStack>

                <XStack>
                  <Button
                    onPress={() => handleToggleTodo(todo.priority)}
                    theme={todo.status === "completed" ? "yellow" : "green"}
                    size="$3"
                    marginRight="$2"
                  >
                    {todo.status === "completed" ? "Undo" : "Done"}
                  </Button>

                  <Button
                    onPress={() => handleDeleteTodo(todo.priority, todo.title)}
                    theme="red"
                    size="$3"
                  >
                    Delete
                  </Button>
                </XStack>
              </XStack>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Stats */}
      {total > 0 && (
        <Card backgroundColor="$gray3" padding="$3" marginTop="$4">
          <Text textAlign="center" color="$gray11">
            {active} active, {completed} completed, {archived} archived ({total}{" "}
            total)
          </Text>
        </Card>
      )}
    </YStack>
  );
}
