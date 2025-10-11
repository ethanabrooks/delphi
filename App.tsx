import { StatusBar } from "expo-status-bar";
import { View, Text, TouchableOpacity } from "react-native";
import { useState } from "react";
import "./global.css";
import Talk from "./components/Talk";
import TodoList from "./components/TodoList";

type AgentType = "talk" | "todo";

export default function App() {
  const [agentType, setAgentType] = useState<AgentType>("talk");

  // Replace with your OpenAI API key
  const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  const renderAgent = () => {
    switch (agentType) {
      case "todo":
        return <TodoList />;
      default:
        return <Talk apiKey={OPENAI_API_KEY} />;
    }
  };

  return (
    <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
      <View className="pt-12 pb-4 px-4">
        <Text className="text-2xl font-bold text-center text-gray-800 mb-4">
          Talk & Todo App
        </Text>

        <View className="flex-row flex-wrap justify-center gap-2 mb-4">
          <TouchableOpacity
            onPress={() => setAgentType("talk")}
            className={`px-3 py-2 rounded-full ${
              agentType === "talk" ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                agentType === "talk" ? "text-white" : "text-gray-700"
              }`}
            >
              Talk
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
        </View>
      </View>

      <View className="flex-1">{renderAgent()}</View>

      <StatusBar style="auto" />
    </View>
  );
}
