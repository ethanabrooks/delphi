import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Priority, PRIORITY_LABELS } from '../types/todo';
import { useTodoStore, useTodoStats, todoVoiceHelpers } from '../stores/simpleTodoStore';
import WebVoiceAgent from '../WebVoiceAgent';

interface VoiceTodoManagerProps {
  apiKey?: string;
}

export default function VoiceTodoManager({ apiKey }: VoiceTodoManagerProps) {
  const [lastCommand, setLastCommand] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Zustand hooks - no more database initialization needed!
  const { todos, loadTodos } = useTodoStore();
  const { total, completed, pending } = useTodoStats();

  // Load todos from localStorage on mount
  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // Enhanced voice processing for todo commands
  const processVoiceTodoCommand = async (transcript: string): Promise<string> => {
    setIsProcessing(true);
    setLastCommand(transcript);

    try {
      const lowerTranscript = transcript.toLowerCase();

      // Add todo commands
      if (lowerTranscript.includes('add') || lowerTranscript.includes('create') || lowerTranscript.includes('new')) {
        return handleAddTodo(transcript);
      }

      // Complete todo commands
      if (lowerTranscript.includes('complete') || lowerTranscript.includes('done') || lowerTranscript.includes('finish')) {
        return handleCompleteTodo(transcript);
      }

      // Delete todo commands
      if (lowerTranscript.includes('delete') || lowerTranscript.includes('remove')) {
        return handleDeleteTodo(transcript);
      }

      // List todos
      if (lowerTranscript.includes('list') || lowerTranscript.includes('show') || lowerTranscript.includes('what')) {
        return handleListTodos();
      }

      // Help command
      if (lowerTranscript.includes('help') || lowerTranscript.includes('commands')) {
        return getHelpMessage();
      }

      // If no command matches, use AI to parse the intent
      if (apiKey) {
        return await parseCommandWithAI(transcript);
      }

      return "I didn't understand that command. Try saying 'add buy milk', 'complete first task', 'list todos', or 'help'.";

    } catch (error) {
      console.error('Failed to process voice command:', error);
      return 'Sorry, I encountered an error processing your command.';
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddTodo = (transcript: string): string => {
    // Extract todo text after command words
    const todoText = extractTodoText(transcript, ['add', 'create', 'new', 'todo']);

    if (!todoText) {
      return "What would you like to add to your todo list?";
    }

    // Detect priority from voice command
    const priority = extractPriority(transcript);

    // Use Zustand helper
    todoVoiceHelpers.addTodoFromVoice(todoText, priority);

    return `Added "${todoText}" to your todo list${priority > 1 ? ` with ${PRIORITY_LABELS[priority].toLowerCase()} priority` : ''}.`;
  };

  const handleCompleteTodo = (transcript: string): string => {
    const todoText = extractTodoText(transcript, ['complete', 'done', 'finish']);

    if (!todoText) {
      // Complete the first todo if no specific one mentioned
      const firstTodo = todoVoiceHelpers.getFirstIncompleteTodo();
      if (!firstTodo) {
        return "You don't have any pending todos to complete.";
      }

      const { toggleTodo } = useTodoStore.getState();
      toggleTodo(firstTodo.id);
      return `Completed "${firstTodo.title}".`;
    }

    // Use Zustand helper to find and complete todo
    const success = todoVoiceHelpers.completeTodoByTitle(todoText);
    if (success) {
      return `Completed todo matching "${todoText}".`;
    }

    return `I couldn't find a pending todo matching "${todoText}".`;
  };

  const handleDeleteTodo = (transcript: string): string => {
    const todoText = extractTodoText(transcript, ['delete', 'remove']);

    if (!todoText) {
      return "Which todo would you like to delete?";
    }

    // Use Zustand helper
    const success = todoVoiceHelpers.deleteTodoByTitle(todoText);
    if (success) {
      return `Deleted todo matching "${todoText}".`;
    }

    return `I couldn't find a todo matching "${todoText}".`;
  };

  const handleListTodos = (): string => {
    // Use Zustand helper
    return todoVoiceHelpers.getTodoSummary();
  };

  const parseCommandWithAI = async (transcript: string): Promise<string> => {
    try {
      const prompt = `Parse this voice command for a todo list app. Respond with exactly one of these actions:
1. ADD: "add:[todo text]:[priority(1-3)]"
2. COMPLETE: "complete:[todo text or 'first']"
3. DELETE: "delete:[todo text]"
4. LIST: "list"
5. UNKNOWN: "unknown"

Voice command: "${transcript}"

Current todos: ${todos.map(t => `${t.id}: ${t.title} (${t.completed ? 'done' : 'pending'})`).join(', ')}

Respond with only the action format, no explanation.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50
        }),
      });

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content?.trim() || 'unknown';

      return executeAIParsedCommand(aiResponse);
    } catch (error) {
      return "I couldn't understand that command. Try 'add buy milk', 'complete first task', or 'list todos'.";
    }
  };

  const executeAIParsedCommand = (aiResponse: string): string => {
    const [action, ...params] = aiResponse.split(':');

    switch (action.toLowerCase()) {
      case 'add':
        if (params.length >= 1) {
          const [todoText, priorityStr] = params;
          const priority = (parseInt(priorityStr) as Priority) || 1;
          todoVoiceHelpers.addTodoFromVoice(todoText, priority);
          return `Added "${todoText}" to your todo list.`;
        }
        break;

      case 'complete':
        if (params[0] === 'first') {
          const firstTodo = todoVoiceHelpers.getFirstIncompleteTodo();
          if (firstTodo) {
            const { toggleTodo } = useTodoStore.getState();
            toggleTodo(firstTodo.id);
            return `Completed "${firstTodo.title}".`;
          }
        } else if (params[0]) {
          const success = todoVoiceHelpers.completeTodoByTitle(params[0]);
          if (success) {
            return `Completed todo matching "${params[0]}".`;
          }
        }
        break;

      case 'delete':
        if (params[0]) {
          const success = todoVoiceHelpers.deleteTodoByTitle(params[0]);
          if (success) {
            return `Deleted todo matching "${params[0]}".`;
          }
        }
        break;

      case 'list':
        return todoVoiceHelpers.getTodoSummary();
    }

    return "I couldn't understand that command.";
  };

  const extractTodoText = (transcript: string, commandWords: string[]): string => {
    const lowerTranscript = transcript.toLowerCase();

    for (const command of commandWords) {
      const index = lowerTranscript.indexOf(command);
      if (index !== -1) {
        return transcript.substring(index + command.length).trim();
      }
    }

    return '';
  };

  const extractPriority = (transcript: string): Priority => {
    const lowerTranscript = transcript.toLowerCase();

    if (lowerTranscript.includes('high priority') || lowerTranscript.includes('urgent')) {
      return 3;
    }
    if (lowerTranscript.includes('medium priority') || lowerTranscript.includes('important')) {
      return 2;
    }

    return 1;
  };

  const getHelpMessage = (): string => {
    return `Here are the voice commands you can use:
• Say "add [item]" to add a new todo
• Say "complete [item]" or "done [item]" to mark as complete
• Say "delete [item]" to remove a todo
• Say "list todos" or "show my todos" to hear all items
• Say "help" to hear this message again

You can also specify priority by saying "high priority" or "urgent" when adding todos.`;
  };

  return (
    <View className="flex-1 p-4">
      <Text className="text-2xl font-bold text-gray-800 mb-4 text-center">
        Voice Todo Manager
      </Text>

      <Text className="text-gray-600 mb-6 text-center">
        Say "add buy milk", "complete first task", "list todos", or "help"
      </Text>

      {/* Todo stats - now with Zustand! */}
      <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
        <Text className="text-lg font-medium text-gray-800 text-center">
          {pending} pending, {completed} completed
        </Text>

        {lastCommand && (
          <View className="mt-3 p-2 bg-blue-50 rounded">
            <Text className="text-sm text-blue-800">
              Last command: "{lastCommand}"
            </Text>
          </View>
        )}
      </View>

      {/* Voice interface */}
      <View className="flex-1">
        <WebVoiceAgent
          apiKey={apiKey}
          customProcessor={processVoiceTodoCommand}
        />
      </View>

      {/* Quick stats of recent todos */}
      {todos.slice(0, 3).length > 0 && (
        <View className="bg-gray-50 p-3 rounded-lg mt-4">
          <Text className="font-medium text-gray-700 mb-2">Recent todos:</Text>
          {todos.slice(0, 3).map(todo => (
            <Text
              key={todo.id}
              className={`text-sm ${todo.completed ? 'text-gray-500 line-through' : 'text-gray-700'}`}
            >
              • {todo.title}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}