import { GripVertical, Mic } from "@tamagui/lucide-icons";
import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Input } from "tamagui";
import useTodosManager from "../hooks/useTodosManager";
import { platformTodoService } from "../services/platformTodoService";
import type { Todo } from "../types/todo";

function TodoItem({
  item,
  drag,
  isActive,
  onComplete,
  onArchive,
}: RenderItemParams<Todo> & {
  onComplete: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  return (
    <ScaleDecorator>
      <View style={[styles.itemContainer, isActive && styles.itemDragging]}>
        <TouchableOpacity onLongPress={drag} activeOpacity={0.9}>
          <GripVertical size={20} color="rgba(255, 255, 255, 0.8)" />
        </TouchableOpacity>
        <View style={styles.itemContent}>
          <Text style={styles.itemText}>{item.title}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => onComplete(item.id)}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.archiveButton}
              onPress={() => onArchive(item.id)}
            >
              <Text style={styles.archiveButtonText}>Archive</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScaleDecorator>
  );
}

export default function TodoList() {
  const {
    todos,
    addTodo,
    toggleCompleted,
    toggleArchived,
    updateTodo,
    refetch,
  } = useTodosManager();
  const [newTodo, setNewTodo] = useState("");
  const [localTodos, setLocalTodos] = useState<Todo[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activeTodos = useMemo(
    () =>
      todos
        .filter((todo) => todo.status === "active")
        .sort((a, b) => (a.priority || 0) - (b.priority || 0)),
    [todos]
  );

  const completedTodos = todos.filter((todo) => todo.status === "completed");
  const archivedTodos = todos.filter((todo) => todo.status === "archived");

  useEffect(() => {
    setLocalTodos(activeTodos);
  }, [activeTodos]);

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;

    await addTodo({
      title: newTodo.trim(),
      priority: activeTodos.length + 1,
    });

    setNewTodo("");
  };

  const handleReorder = async (reorderedTodos: Todo[]) => {
    setLocalTodos(reorderedTodos);

    // Build batch update payload
    const updates = reorderedTodos
      .map((todo, i) => ({
        id: todo.id,
        priority: i + 1,
      }))
      .filter((update, i) => reorderedTodos[i].priority !== update.priority);

    // Use batch update to set all priorities at once
    await platformTodoService.batchUpdatePriorities(updates);

    // Manually refetch to see the updated priorities
    await refetch();
  };

  const handleComplete = async (id: number) => {
    await toggleCompleted(id);
  };

  const handleArchive = async (id: number) => {
    await updateTodo({
      id,
      status: "archived",
    });
  };

  const handleRestoreArchived = async (id: number) => {
    await toggleArchived(id);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Tasks</Text>
          <Link href="/talk" style={styles.hamburger}>
            <Mic size={20} color="#38bdf8" />
          </Link>
        </View>

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

        {localTodos.length > 0 && (
          <View style={styles.listContainer}>
            <DraggableFlatList
              data={localTodos}
              onDragEnd={({ data }) => handleReorder(data)}
              keyExtractor={(item) => item.id.toString()}
              renderItem={(params) => (
                <TodoItem
                  {...params}
                  onComplete={handleComplete}
                  onArchive={handleArchive}
                />
              )}
              scrollEnabled={false}
            />
          </View>
        )}

        {completedTodos.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.toggleButton}
              onPress={() => setShowCompleted(!showCompleted)}
            >
              <Text style={styles.toggleButtonText}>
                {showCompleted ? "▼" : "▶"} Completed ({completedTodos.length})
              </Text>
            </TouchableOpacity>

            {showCompleted && (
              <View>
                {completedTodos.map((todo) => (
                  <View key={todo.id} style={styles.completedCard}>
                    <Text style={styles.completedText}>{todo.title}</Text>
                    <TouchableOpacity
                      style={styles.undoButton}
                      onPress={() => handleComplete(todo.id)}
                    >
                      <Text style={styles.undoButtonText}>Undo</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {archivedTodos.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.toggleButton}
              onPress={() => setShowArchived(!showArchived)}
            >
              <Text style={styles.toggleButtonText}>
                {showArchived ? "▼" : "▶"} Archived ({archivedTodos.length})
              </Text>
            </TouchableOpacity>

            {showArchived && (
              <View>
                {archivedTodos.map((todo) => (
                  <View key={todo.id} style={styles.archivedCard}>
                    <Text style={styles.archivedText}>{todo.title}</Text>
                    <TouchableOpacity
                      style={styles.restoreButton}
                      onPress={() => handleRestoreArchived(todo.id)}
                    >
                      <Text style={styles.restoreButtonText}>Restore</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
    marginTop: 40,
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
  listContainer: {
    marginBottom: 32,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    marginVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemDragging: {
    opacity: 0.7,
  },
  itemText: {
    color: "#f8fafc",
    fontSize: 16,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  doneButton: {
    backgroundColor: "#38bdf8",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.65)",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  doneButtonText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  archiveButton: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  archiveButtonText: {
    color: "#e0f2fe",
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    marginTop: 24,
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
  completedCard: {
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    padding: 18,
    marginBottom: 16,
    opacity: 0.75,
  },
  completedText: {
    color: "rgba(226, 232, 240, 0.75)",
    fontSize: 16,
    lineHeight: 22,
    textDecorationLine: "line-through",
  },
  undoButton: {
    backgroundColor: "#38bdf8",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.65)",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 14,
    alignSelf: "flex-start",
  },
  undoButtonText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  archivedCard: {
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    padding: 18,
    marginBottom: 16,
    opacity: 0.6,
  },
  archivedText: {
    color: "rgba(148, 163, 184, 0.75)",
    fontSize: 16,
    lineHeight: 22,
  },
  restoreButton: {
    backgroundColor: "#38bdf8",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.65)",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 14,
    alignSelf: "flex-start",
  },
  restoreButtonText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
});
