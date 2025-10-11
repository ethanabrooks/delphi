import { StatusBar } from "expo-status-bar";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useState } from "react";
import "./global.css";
import WebVoiceAgent from "./WebVoiceAgent";
import RealtimeVoiceAgent from "./RealtimeVoiceAgent";
import TodoList from "./components/TodoList";
import VoiceTodoManager from "./components/VoiceTodoManager";

// For now, we'll only use WebVoiceAgent which works across all platforms
// TODO: Add platform-specific VoiceAgent for better native performance

type AgentType = "basic" | "realtime" | "todo" | "voice-todo";

export default function App() {
  const [agentType, setAgentType] = useState<AgentType>("basic");

  // Replace with your OpenAI API key
  const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  const renderAgent = () => {
    switch (agentType) {
      case "realtime":
        return <RealtimeVoiceAgent apiKey={OPENAI_API_KEY} />;
      case "todo":
        return <TodoList />;
      case "voice-todo":
        return <VoiceTodoManager apiKey={OPENAI_API_KEY} />;
      default:
        // Use WebVoiceAgent which works across all platforms
        return <WebVoiceAgent apiKey={OPENAI_API_KEY} />;
    }
  };

  return (
    <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
      <View className="pt-12 pb-4 px-4">
        <Text className="text-2xl font-bold text-center text-gray-800 mb-4">
          Voice Agent Demo
        </Text>

        <View className="flex-row flex-wrap justify-center gap-2 mb-4">
          <TouchableOpacity
            onPress={() => setAgentType("basic")}
            className={`px-3 py-2 rounded-full ${
              agentType === "basic" ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                agentType === "basic" ? "text-white" : "text-gray-700"
              }`}
            >
              Voice Chat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAgentType("realtime")}
            className={`px-3 py-2 rounded-full ${
              agentType === "realtime" ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                agentType === "realtime" ? "text-white" : "text-gray-700"
              }`}
            >
              Realtime
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAgentType("todo")}
            className={`px-3 py-2 rounded-full ${
              agentType === "todo" ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                agentType === "todo" ? "text-white" : "text-gray-700"
              }`}
            >
              Todo List
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAgentType("voice-todo")}
            className={`px-3 py-2 rounded-full ${
              agentType === "voice-todo" ? "bg-purple-500" : "bg-gray-300"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                agentType === "voice-todo" ? "text-white" : "text-gray-700"
              }`}
            >
              Voice Todos
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1">{renderAgent()}</View>

      <StatusBar style="auto" />
    </View>
  );
}
