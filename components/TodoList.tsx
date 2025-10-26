import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Mic } from "@tamagui/lucide-icons";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Input } from "tamagui";
import { platformTodoService } from "../services/platformTodoService";
import useTodosManager from "../hooks/useTodosManager";
import type { Todo } from "../types/todo";

function SortableItem({
  item,
  onComplete,
  onArchive,
}: {
  item: Todo;
  onComplete: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <View
        style={[
          styles.itemContainer,
          isDragging && styles.itemDragging,
        ]}
      >
        <div {...listeners} style={{ display: "flex", cursor: "grab" }}>
          <GripVertical size={20} color="rgba(255, 255, 255, 0.8)" />
        </div>
        <View style={styles.itemContent}>
          <Text style={styles.itemText}>{item.title}</Text>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={() => onComplete(item.id)}
              style={{
                backgroundColor: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.65)",
                borderRadius: 999,
                paddingLeft: 18,
                paddingRight: 18,
                paddingTop: 10,
                paddingBottom: 10,
                color: "#0f172a",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done
            </button>
            <button
              onClick={() => onArchive(item.id)}
              style={{
                backgroundColor: "rgba(56, 189, 248, 0.08)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                borderRadius: 999,
                paddingLeft: 18,
                paddingRight: 18,
                paddingTop: 10,
                paddingBottom: 10,
                color: "#e0f2fe",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Archive
            </button>
          </div>
        </View>
      </View>
    </div>
  );
}

function SortableList({
  items,
  onReorder,
  onComplete,
  onArchive,
}: {
  items: Todo[];
  onReorder: (items: Todo[]) => void;
  onComplete: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  }

  return (
    <View style={styles.listContainer}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              onComplete={onComplete}
              onArchive={onArchive}
            />
          ))}
        </SortableContext>
      </DndContext>
    </View>
  );
}

export default function TodoList() {
  const {
    todos,
    addTodo,
    reorderTodo,
    toggleCompleted,
    toggleArchived,
    updateTodo,
    refetch,
  } = useTodosManager();
  const [newTodo, setNewTodo] = useState("");
  const [localTodos, setLocalTodos] = useState<Todo[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activeTodos = todos
    .filter((todo) => todo.status === "active")
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  const completedTodos = todos.filter((todo) => todo.status === "completed");
  const archivedTodos = todos.filter((todo) => todo.status === "archived");

  useEffect(() => {
    console.log("Active todos ordered by priority:",
      activeTodos.map(t => ({ id: t.id, title: t.title, priority: t.priority }))
    );
    setLocalTodos(activeTodos);
  }, [todos]);

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;

    await addTodo({
      title: newTodo.trim(),
      priority: activeTodos.length + 1,
    });

    setNewTodo("");
  };

  const handleReorder = async (reorderedTodos: Todo[]) => {
    console.log("Reordering todos:");
    reorderedTodos.forEach((todo, i) => {
      console.log(`  [${i}] ${todo.title} - old priority: ${todo.priority}, new priority: ${i + 1}`);
    });

    setLocalTodos(reorderedTodos);

    // Build batch update payload
    const updates = reorderedTodos
      .map((todo, i) => ({
        id: todo.id,
        priority: i + 1,
      }))
      .filter((update, i) => reorderedTodos[i].priority !== update.priority);

    console.log(`Batch updating ${updates.length} priorities`);

    // Use batch update to set all priorities at once
    await platformTodoService.batchUpdatePriorities(updates);

    console.log("Batch update complete, refetching todos");

    // Manually refetch to see the updated priorities
    await refetch();

    console.log("All updates complete, priorities should now be saved");
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

      <SortableList
        items={localTodos}
        onReorder={handleReorder}
        onComplete={handleComplete}
        onArchive={handleArchive}
      />

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
                  <button
                    onClick={() => handleComplete(todo.id)}
                    style={{
                      backgroundColor: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.65)",
                      borderRadius: 999,
                      paddingLeft: 18,
                      paddingRight: 18,
                      paddingTop: 10,
                      paddingBottom: 10,
                      color: "#0f172a",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      marginTop: 14,
                    }}
                  >
                    Undo
                  </button>
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
                  <button
                    onClick={() => handleRestoreArchived(todo.id)}
                    style={{
                      backgroundColor: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.65)",
                      borderRadius: 999,
                      paddingLeft: 18,
                      paddingRight: 18,
                      paddingTop: 10,
                      paddingBottom: 10,
                      color: "#0f172a",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      marginTop: 14,
                    }}
                  >
                    Restore
                  </button>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
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
});
