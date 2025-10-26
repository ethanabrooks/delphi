import { Mic } from "@tamagui/lucide-icons";
import { Link } from "expo-router";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  type EdgeInsets,
  SafeAreaInsetsContext,
} from "react-native-safe-area-context";
import { Card, Input, ScrollView, Text, View, XStack } from "tamagui";
import useTodosManager from "../hooks/useTodosManager";
import type { Todo } from "../types/todo";
import { getNextHighestPriority } from "../utils/priorityUtils";

// Removed all styled components - using Tamagui components directly

export default function TodoList() {
  const safeAreaInsets = useContext(SafeAreaInsetsContext);
  const insets: EdgeInsets = safeAreaInsets ?? {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
  const [newTodo, setNewTodo] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const completedAnimation = useRef(new Animated.Value(0)).current;
  const archivedAnimation = useRef(new Animated.Value(0)).current;
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
    if (Platform.OS === "ios" || Platform.OS === "android") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    const toValue = showCompleted ? 0 : 1;
    setShowCompleted(!showCompleted);

    Animated.timing(completedAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showCompleted]);

  const toggleArchivedSection = useCallback(() => {
    if (Platform.OS === "ios" || Platform.OS === "android") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    const toValue = showArchived ? 0 : 1;
    setShowArchived(!showArchived);

    Animated.timing(archivedAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showArchived]);

  // Keyboard navigation support

  const { activeTodos, completedTodos, archivedTodos } = todosByStatus;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.safeArea,
            {
              paddingTop: Math.max(insets.top, 28),
              paddingBottom: Math.max(insets.bottom, 32),
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Tasks</Text>
            <Link href="/talk" style={styles.hamburger}>
              <Mic size={20} color="#38bdf8" />
            </Link>
          </View>

          {error && (
            <Card style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          )}

          <View style={styles.inputCard}>
            <Input
              unstyled
              value={newTodo}
              onChangeText={setNewTodo}
              onSubmitEditing={handleAddTodo}
              placeholder="Capture a task..."
              placeholderTextColor="rgba(203,213,225,0.45)"
              style={styles.input}
              testID="todo-input"
              returnKeyType="done"
            />
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTodos.length > 0 ? (
              activeTodos.map((todo) => (
                <Card key={todo.id} style={styles.todoCard}>
                  <Text style={styles.todoText}>{todo.title}</Text>
                  <XStack space="$2" style={styles.todoActions}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.actionButton, styles.completeButton]}
                      onPress={() => handleToggleCompleted(todo)}
                    >
                      <Text style={styles.actionButtonText}>Done</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.actionButton, styles.archiveButton]}
                      onPress={() => handleArchiveTodo(todo)}
                    >
                      <Text style={styles.actionSecondaryText}>Archive</Text>
                    </TouchableOpacity>
                  </XStack>
                </Card>
              ))
            ) : (
              <Text style={styles.emptyState}>No active todos</Text>
            )}

            {completed > 0 && (
              <View style={styles.section}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.toggleButton}
                  onPress={toggleCompletedSection}
                >
                  <Text style={styles.toggleButtonText}>
                    {showCompleted ? "▼" : "▶"} Completed ({completed})
                  </Text>
                </TouchableOpacity>

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
                      style={[styles.todoCard, styles.completedCard]}
                    >
                      <Text style={[styles.todoText, styles.completedText]}>
                        {todo.title}
                      </Text>
                      <XStack space="$2" style={styles.todoActions}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={[styles.actionButton, styles.completeButton]}
                          onPress={() => handleToggleCompleted(todo)}
                        >
                          <Text style={styles.actionButtonText}>Undo</Text>
                        </TouchableOpacity>
                      </XStack>
                    </Card>
                  ))}
                </Animated.View>
              </View>
            )}

            {archived > 0 && (
              <View style={styles.section}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.toggleButton}
                  onPress={toggleArchivedSection}
                >
                  <Text style={styles.toggleButtonText}>
                    {showArchived ? "▼" : "▶"} Archived ({archived})
                  </Text>
                </TouchableOpacity>

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
                      style={[styles.todoCard, styles.archivedCard]}
                    >
                      <Text style={[styles.todoText, styles.archivedText]}>
                        {todo.title}
                      </Text>
                      <XStack space="$2" style={styles.todoActions}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={[styles.actionButton, styles.completeButton]}
                          onPress={() => handleToggleArchived(todo)}
                        >
                          <Text style={styles.actionButtonText}>Restore</Text>
                        </TouchableOpacity>
                      </XStack>
                    </Card>
                  ))}
                </Animated.View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 24,
    maxWidth: 520,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#f1f5f9",
    letterSpacing: 0.5,
  },
  hamburger: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  errorCard: {
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.35)",
    marginBottom: 16,
  },
  errorText: {
    color: "#fecaca",
    textAlign: "center",
    fontSize: 14,
  },
  inputCard: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 24,
  },
  input: {
    backgroundColor: "transparent",
    color: "#f8fafc",
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderWidth: 0,
  },
  listContent: {
    paddingBottom: 120,
  },
  section: {
    marginTop: 24,
  },
  todoCard: {
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    padding: 18,
    marginBottom: 16,
  },
  todoText: {
    color: "#f8fafc",
    fontSize: 16,
    lineHeight: 22,
  },
  todoActions: {
    marginTop: 14,
  },
  actionButton: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  completeButton: {
    backgroundColor: "#38bdf8",
    borderColor: "rgba(56, 189, 248, 0.65)",
  },
  archiveButton: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  actionButtonText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  actionSecondaryText: {
    color: "#e0f2fe",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    color: "rgba(226, 232, 240, 0.55)",
    textAlign: "center",
    marginTop: 48,
    fontSize: 15,
  },
  completedCard: {
    opacity: 0.75,
  },
  completedText: {
    textDecorationLine: "line-through",
    color: "rgba(226, 232, 240, 0.75)",
  },
  archivedCard: {
    opacity: 0.6,
  },
  archivedText: {
    color: "rgba(148, 163, 184, 0.75)",
  },
  toggleButton: {
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "flex-start",
    marginBottom: 12,
  },
  toggleButtonText: {
    color: "rgba(226, 232, 240, 0.65)",
    fontSize: 14,
    fontWeight: "600",
  },
});
