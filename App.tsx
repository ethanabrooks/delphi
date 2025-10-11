import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Button, TamaguiProvider, Text, XStack, YStack } from "tamagui";
import Talk from "./components/Talk";
import TodoList from "./components/TodoList";
import tamaguiConfig from "./tamagui.config";

type AgentType = "talk" | "todo";

console.log("🚀 App.tsx loading...");
console.log("🔧 tamaguiConfig:", tamaguiConfig);
console.log("📦 TamaguiProvider:", typeof TamaguiProvider);
console.log("📦 YStack:", typeof YStack, "from tamagui");
console.log("📦 Button:", typeof Button, "from tamagui");
console.log("📦 Text:", typeof Text, "from tamagui");

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

  console.log("🎨 App rendering with agentType:", agentType);

  return (
    <TamaguiProvider config={tamaguiConfig}>
      <YStack flex={1} backgroundColor="$blue2" paddingTop="$12">
        <YStack paddingTop="$4" paddingBottom="$2" paddingHorizontal="$4">
          <Text
            fontSize="$8"
            fontWeight="bold"
            textAlign="center"
            color="$gray12"
            marginBottom="$4"
          >
            Talk & Todo App
          </Text>

          <XStack
            justifyContent="center"
            gap="$2"
            marginBottom="$4"
            flexWrap="wrap"
          >
            <Button
              onPress={() => setAgentType("talk")}
              theme={agentType === "talk" ? "blue" : "gray"}
              size="$3"
              borderRadius="$10"
            >
              Talk
            </Button>

            <Button
              onPress={() => setAgentType("todo")}
              theme={agentType === "todo" ? "green" : "gray"}
              size="$3"
              borderRadius="$10"
            >
              Todo List
            </Button>
          </XStack>
        </YStack>

        <YStack flex={1}>{renderAgent()}</YStack>

        <StatusBar style="auto" />
      </YStack>
    </TamaguiProvider>
  );
}
