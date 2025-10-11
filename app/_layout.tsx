import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "../tamagui.config";

export default function RootLayout() {
  const config = useMemo(() => tamaguiConfig, []);

  return (
    <TamaguiProvider config={config}>
      <StatusBar style="auto" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#2563eb",
        }}
      >
        <Tabs.Screen name="talk" options={{ title: "Talk" }} />
        <Tabs.Screen name="todo" options={{ title: "Todo" }} />
      </Tabs>
    </TamaguiProvider>
  );
}
