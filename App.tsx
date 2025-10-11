import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Button, TamaguiProvider, Text, XStack, YStack } from "tamagui";
import Talk from "./components/Talk";
import TodoList from "./components/TodoList";
import tamaguiConfig from "./tamagui.config";

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
              theme={agentType === "talk" ? "light_blue" : "light"}
              size="$3"
              borderRadius="$10"
            >
              Talk
            </Button>

            <Button
              onPress={() => setAgentType("todo")}
              theme={agentType === "todo" ? "light_green" : "light"}
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
