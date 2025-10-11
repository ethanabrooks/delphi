// Using built-in Jest matchers from @testing-library/react-native v12.4+

// Mock react-native-reanimated
jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock expo-sqlite
jest.mock("expo-sqlite", () => ({
  openDatabase: jest.fn(() => ({
    exec: jest.fn((queries, readOnly, callback) => callback(null, [])),
    transaction: jest.fn(),
  })),
}));

// AsyncStorage not used in this project, skip mock

// Mock react-native Alert
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.Alert = {
    alert: jest.fn(),
  };
  return RN;
});

// Mock Tamagui components
jest.mock("tamagui", () => ({
  TamaguiProvider: ({ children }) => children,
  createTamagui: jest.fn(),
  config: {},
  Button: "Button",
  Card: "Card",
  Input: "Input",
  Text: "Text",
  YStack: "YStack",
  XStack: "XStack",
  ScrollView: "ScrollView",
}));
