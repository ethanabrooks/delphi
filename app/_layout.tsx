import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "../tamagui.config";

export default function RootLayout() {
  const config = useMemo(() => tamaguiConfig, []);

  return (
    <TamaguiProvider config={config}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="talk" />
        <Stack.Screen name="todo" />
      </Stack>
    </TamaguiProvider>
  );
}
