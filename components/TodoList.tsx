import { Link } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Animated, StyleSheet } from "react-native";
import { Button, Card, Input, ScrollView, Text, View, XStack } from "tamagui";
import { Mic } from "@tamagui/lucide-icons";
import useTodosManager from "../hooks/useTodosManager";
import type { Todo } from "../types/todo";
import { getNextHighestPriority } from "../utils/priorityUtils";

// Removed all styled components - using Tamagui components directly

export default function TodoList() {
  const [newTodo, setNewTodo] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const completedAnimation = new Animated.Value(0);
  const archivedAnimation = new Animated.Value(0);
  const {
    todos,
    stats,
    error,
    addTodo,
    updateTodo,
    toggleCompleted,
    toggleArchived,
  } = useTodosManager();

  const { completed, archived } = stats;

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

  const handleToggleCompleted = useCallback(
    async (todo: Todo) => {
      await toggleCompleted(todo.id);
    },
    [toggleCompleted]
  );

  const handleToggleArchived = useCallback(
    async (todo: Todo) => {
      await toggleArchived(todo.id);
    },
    [toggleArchived]
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

  const toggleCompletedSection = useCallback(() => {
    const toValue = showCompleted ? 0 : 1;
    setShowCompleted(!showCompleted);

    Animated.timing(completedAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showCompleted, completedAnimation]);

  const toggleArchivedSection = useCallback(() => {
    const toValue = showArchived ? 0 : 1;
    setShowArchived(!showArchived);

    Animated.timing(archivedAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showArchived, archivedAnimation]);

  // Keyboard navigation support

  const { activeTodos, completedTodos, archivedTodos } = todosByStatus;

  return (
    <View style={styles.container}>
      {/* Talk navigation */}
      <Link href="/talk" style={styles.hamburger}>
        <Mic size={24} color="#888888" />
      </Link>

      <View style={styles.content}>
        {/* Error display */}
        {error && (
          <Card
            backgroundColor="rgba(255, 0, 0, 0.1)"
            padding="$3"
            marginBottom="$4"
          >
            <Text color="#ff6666" textAlign="center" fontSize="$3">
              {error}
            </Text>
          </Card>
        )}

        {/* Add new todo input */}
        <View style={styles.inputContainer}>
          <Input
            value={newTodo}
            onChangeText={setNewTodo}
            onSubmitEditing={handleAddTodo}
            placeholder="What needs to be done?"
            placeholderTextColor="#666666"
            style={styles.input}
            testID="todo-input"
          />
        </View>

        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          {/* Active Todos */}
          {activeTodos.map((todo) => (
            <Card key={todo.id} style={styles.todoCard}>
              <Text style={styles.todoText}>{todo.title}</Text>
              <XStack style={styles.todoActions}>
                <Button
                  size="$2"
                  style={styles.actionButton}
                  onPress={() => handleToggleCompleted(todo)}
                >
                  <Text color="#ffffff" fontSize="$2">
                    Done
                  </Text>
                </Button>
                <Button
                  size="$2"
                  style={styles.actionButton}
                  onPress={() => handleArchiveTodo(todo)}
                >
                  <Text color="#ffffff" fontSize="$2">
                    Archive
                  </Text>
                </Button>
              </XStack>
            </Card>
          ))}

          {activeTodos.length === 0 && (
            <Text
              style={[
                styles.todoText,
                { textAlign: "center", opacity: 0.5, marginTop: 40 },
              ]}
            >
              No active todos
            </Text>
          )}

          {/* Completed Todos Section */}
          {completed > 0 && (
            <>
              <Button
                style={styles.toggleButton}
                onPress={toggleCompletedSection}
              >
                <Text style={styles.toggleButtonText}>
                  {showCompleted ? "▼" : "▶"} Completed ({completed})
                </Text>
              </Button>

              <Animated.View
                style={{
                  maxHeight: completedAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1000],
                  }),
                  opacity: completedAnimation,
                  overflow: "hidden",
                }}
              >
                {completedTodos.map((todo) => (
                  <Card
                    key={todo.id}
                    style={[styles.todoCard, { opacity: 0.6 }]}
                  >
                    <Text
                      style={[
                        styles.todoText,
                        { textDecorationLine: "line-through" },
                      ]}
                    >
                      {todo.title}
                    </Text>
                    <XStack style={styles.todoActions}>
                      <Button
                        size="$2"
                        style={styles.actionButton}
                        onPress={() => handleToggleCompleted(todo)}
                      >
                        <Text color="#ffffff" fontSize="$2">
                          Undo
                        </Text>
                      </Button>
                    </XStack>
                  </Card>
                ))}
              </Animated.View>
            </>
          )}

          {/* Archived Todos Section */}
          {archived > 0 && (
            <>
              <Button
                style={styles.toggleButton}
                onPress={toggleArchivedSection}
              >
                <Text style={styles.toggleButtonText}>
                  {showArchived ? "▼" : "▶"} Archived ({archived})
                </Text>
              </Button>

              <Animated.View
                style={{
                  maxHeight: archivedAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1000],
                  }),
                  opacity: archivedAnimation,
                  overflow: "hidden",
                }}
              >
                {archivedTodos.map((todo) => (
                  <Card
                    key={todo.id}
                    style={[styles.todoCard, { opacity: 0.4 }]}
                  >
                    <Text style={[styles.todoText, { color: "#888888" }]}>
                      {todo.title}
                    </Text>
                    <XStack style={styles.todoActions}>
                      <Button
                        size="$2"
                        style={styles.actionButton}
                        onPress={() => handleToggleArchived(todo)}
                      >
                        <Text color="#ffffff" fontSize="$2">
                          Restore
                        </Text>
                      </Button>
                    </XStack>
                  </Card>
                ))}
              </Animated.View>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  hamburger: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 100,
  },
  inputContainer: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    color: "#ffffff",
    fontSize: 16,
    padding: 15,
    borderRadius: 8,
  },
  todoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 8,
    padding: 15,
    borderRadius: 8,
  },
  todoText: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 22,
  },
  todoActions: {
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginRight: 8,
  },
  toggleButton: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 10,
    marginVertical: 8,
    justifyContent: "flex-start",
  },
  toggleButtonText: {
    color: "#888888",
    fontSize: 14,
  },
});
