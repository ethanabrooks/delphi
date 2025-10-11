import type React from "react";
import { vi } from "vitest";

// Mock react-native-reanimated
vi.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock expo-sqlite
vi.mock("expo-sqlite", () => ({
  openDatabase: vi.fn(() => ({
    exec: vi.fn((_queries: any, _readOnly: any, callback: any) =>
      callback(null, [])
    ),
    transaction: vi.fn(),
  })),
}));

// Mock react-native Alert
vi.mock("react-native", async () => {
  const RN = await vi.importActual("react-native");
  return {
    ...RN,
    Alert: {
      alert: vi.fn(),
    },
  };
});

// Mock Tamagui components
vi.mock("tamagui", () => ({
  TamaguiProvider: ({ children }: { children: React.ReactNode }) => children,
  createTamagui: vi.fn(),
  config: {},
  Button: "Button",
  Card: "Card",
  Input: "Input",
  Text: "Text",
  YStack: "YStack",
  XStack: "XStack",
  ScrollView: "ScrollView",
}));
