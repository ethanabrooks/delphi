import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Priority, PRIORITY_LABELS, PRIORITY_COLORS } from '../types/todo';
import { useTodoStore, useTodoStats } from '../stores/simpleTodoStore';

export default function TodoList() {
  const [newTodo, setNewTodo] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<Priority>(1);

  // Zustand hooks - much cleaner than database calls!
  const { todos, addTodo, updateTodo, deleteTodo, toggleTodo, loadTodos } = useTodoStore();
  const { total, completed, pending } = useTodoStats();

  // Load todos from localStorage on mount
  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const handleAddTodo = () => {
    if (!newTodo.trim()) {
      Alert.alert('Error', 'Please enter a todo item');
      return;
    }

    addTodo({
      title: newTodo.trim(),
      priority: selectedPriority,
    });

    setNewTodo('');
    setSelectedPriority(1);
  };

  const handleToggleTodo = (todoId: number) => {
    toggleTodo(todoId);
  };

  const handleDeleteTodo = (todoId: number, title: string) => {
    Alert.alert(
      'Delete Todo',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTodo(todoId),
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <View className="flex-1 p-4">
      <Text className="text-2xl font-bold text-gray-800 mb-6 text-center">
        My Todo List
      </Text>

      {/* Add new todo */}
      <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
        <TextInput
          value={newTodo}
          onChangeText={setNewTodo}
          placeholder="What needs to be done?"
          className="border border-gray-300 rounded-lg px-3 py-2 mb-3"
          multiline
          onSubmitEditing={handleAddTodo}
        />

        {/* Priority selection */}
        <View className="flex-row mb-3">
          <Text className="text-gray-700 mr-3 py-2">Priority:</Text>
          {([1, 2, 3] as Priority[]).map((priority) => (
            <TouchableOpacity
              key={priority}
              onPress={() => setSelectedPriority(priority)}
              className={`px-3 py-1 rounded-full mr-2 ${
                selectedPriority === priority
                  ? PRIORITY_COLORS[priority]
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              <Text className={selectedPriority === priority ? '' : 'text-gray-600'}>
                {PRIORITY_LABELS[priority]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleAddTodo}
          className="bg-blue-500 py-3 rounded-lg"
        >
          <Text className="text-white text-center font-semibold">Add Todo</Text>
        </TouchableOpacity>
      </View>

      {/* Todo list */}
      <ScrollView className="flex-1">
        {todos.length === 0 ? (
          <View className="bg-gray-50 p-8 rounded-lg">
            <Text className="text-gray-500 text-center text-lg">
              No todos yet! Add one above.
            </Text>
          </View>
        ) : (
          todos.map((todo) => (
            <View
              key={todo.id}
              className={`bg-white p-4 rounded-lg shadow-sm mb-3 ${
                todo.completed ? 'opacity-60' : ''
              }`}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1 mr-3">
                  <TouchableOpacity onPress={() => handleToggleTodo(todo.id)}>
                    <Text
                      className={`text-lg font-medium ${
                        todo.completed
                          ? 'line-through text-gray-500'
                          : 'text-gray-800'
                      }`}
                    >
                      {todo.title}
                    </Text>
                  </TouchableOpacity>

                  {todo.description && (
                    <Text className="text-gray-600 mt-1">{todo.description}</Text>
                  )}

                  <View className="flex-row items-center mt-2">
                    <View className={`px-2 py-1 rounded-full mr-2 ${PRIORITY_COLORS[todo.priority]}`}>
                      <Text className="text-xs font-medium">
                        {PRIORITY_LABELS[todo.priority]}
                      </Text>
                    </View>

                    {todo.category && (
                      <View className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">
                        <Text className="text-xs text-blue-800">{todo.category}</Text>
                      </View>
                    )}

                    <Text className="text-xs text-gray-500">
                      {formatDate(todo.created_at)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row">
                  <TouchableOpacity
                    onPress={() => handleToggleTodo(todo.id)}
                    className={`px-3 py-2 rounded-lg mr-2 ${
                      todo.completed
                        ? 'bg-yellow-100'
                        : 'bg-green-100'
                    }`}
                  >
                    <Text className={`text-sm font-medium ${
                      todo.completed ? 'text-yellow-800' : 'text-green-800'
                    }`}>
                      {todo.completed ? 'Undo' : 'Done'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteTodo(todo.id, todo.title)}
                    className="bg-red-100 px-3 py-2 rounded-lg"
                  >
                    <Text className="text-red-800 text-sm font-medium">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Stats */}
      {total > 0 && (
        <View className="bg-gray-100 p-3 rounded-lg mt-4">
          <Text className="text-center text-gray-600">
            {pending} of {total} remaining ({completed} completed)
          </Text>
        </View>
      )}
    </View>
  );
}