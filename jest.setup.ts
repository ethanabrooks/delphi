import type { ChangeEvent, ComponentType, ReactNode, Ref } from "react";

const reactSingletonSetup = require("react") as typeof import("react");
const globalReactRef = globalThis as {
  __delphiReactSingleton?: typeof reactSingletonSetup;
};
if (!globalReactRef.__delphiReactSingleton) {
  globalReactRef.__delphiReactSingleton = reactSingletonSetup;
}

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (() => ({
    matches: false,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

// React Native Reanimated needs a manual mock for Jest
jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");

  // Reanimated's mock has a default export of undefined, so we assign the animations API manually
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      children,
    TouchableOpacity: "TouchableOpacity",
    ScrollView: "ScrollView",
  };
});

// Mock react-native-draggable-flatlist
jest.mock("react-native-draggable-flatlist", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({
      data,
      renderItem,
    }: {
      data: unknown[];
      renderItem: (params: {
        item: unknown;
        drag: () => void;
        isActive: boolean;
      }) => React.ReactNode;
    }) =>
      React.createElement(
        View,
        null,
        data.map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: index },
            renderItem({ item, drag: jest.fn(), isActive: false })
          )
        )
      ),
    ScaleDecorator: ({ children }: { children: React.ReactNode }) => children,
  };
});

// The DevMenu module isn't available in Jest's environment
jest.mock("react-native/src/private/devsupport/devmenu/DevMenu", () => ({
  show: jest.fn(),
  hide: jest.fn(),
}));

// Provide a minimal Expo SQLite mock so modules importing it don't crash
jest.mock("expo-sqlite", () => {
  const databaseMock = {
    execAsync: jest.fn().mockResolvedValue(undefined),
    serializeAsync: jest.fn().mockResolvedValue(new Uint8Array()),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };

  return {
    openDatabaseAsync: jest.fn(async () => databaseMock),
    openDatabaseSync: jest.fn(() => databaseMock),
    SQLiteDatabase: jest.fn(() => databaseMock),
  };
});

// Provide lightweight Tamagui primitives backed by React Native components
jest.mock("tamagui", () => {
  const React = require("react") as typeof import("react");
  const {
    View,
    Text: RNText,
    ScrollView: RNScrollView,
    TextInput,
    Pressable,
  } = require("react-native");

  const wrap = (Component: ComponentType<Record<string, unknown>>) =>
    React.forwardRef<
      unknown,
      { children?: ReactNode } & Record<string, unknown>
    >(
      (
        {
          children,
          ...rest
        }: { children?: ReactNode } & Record<string, unknown>,
        ref: Ref<unknown>
      ) => React.createElement(Component, { ref, ...rest }, children)
    );

  const Button = React.forwardRef<
    unknown,
    { children?: ReactNode; onPress?: () => void; disabled?: boolean } & Record<
      string,
      unknown
    >
  >(
    (
      {
        children,
        onPress,
        disabled,
        ...rest
      }: {
        children?: ReactNode;
        onPress?: () => void;
        disabled?: boolean;
      } & Record<string, unknown>,
      ref: Ref<unknown>
    ) =>
      React.createElement(
        Pressable,
        { ref, onPress, accessibilityRole: "button", disabled, ...rest },
        children
      )
  );

  const Input = React.forwardRef<
    unknown,
    {
      children?: ReactNode;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    } & Record<string, unknown>
  >(
    (
      {
        onChangeText,
        ...rest
      }: {
        children?: ReactNode;
        onChangeText?: (value: string) => void;
        placeholder?: string;
        value?: string;
      } & Record<string, unknown>,
      ref: Ref<unknown>
    ) =>
      React.createElement(TextInput, {
        ref,
        ...rest,
        onChange:
          onChangeText !== undefined
            ? (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                onChangeText(event.target.value)
            : undefined,
      })
  );

  return {
    TamaguiProvider: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Button,
    Card: wrap(View),
    Input,
    ScrollView: wrap(RNScrollView),
    Text: wrap(RNText),
    View: wrap(View),
    XStack: wrap(View),
    YStack: wrap(View),
  };
});

// Mock Tamagui Lucide icons
jest.mock("@tamagui/lucide-icons", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native");

  const MockIcon = React.forwardRef<
    unknown,
    { children?: ReactNode } & Record<string, unknown>
  >((props, ref) => React.createElement(View, { ref, ...props }));

  return {
    Mic: MockIcon,
  };
});

// Default Alert mock so tests can assert against calls without failing
const { Alert } = require("react-native");
if (!jest.isMockFunction(Alert.alert)) {
  jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
}

// Mock the initializeDatabase function to prevent act warnings
jest.mock("./db/database", () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

// Suppress React act() warnings in tests - these are unavoidable when Zustand store
// updates happen during component lifecycle and don't affect actual functionality
// biome-ignore lint/suspicious/noConsole: test environment overrides console.error for noise control
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = args[0]?.toString() || "";

  // Suppress specific React act() warnings that occur during store updates
  if (
    message.includes(
      "An update to TodoList inside a test was not wrapped in act"
    ) ||
    message.includes("was not wrapped in act(...)")
  ) {
    return;
  }

  // Allow all other console.error messages through
  const typedArgs = args as Parameters<typeof console.error>;
  originalConsoleError.apply(console, typedArgs);
};

// Mock expo-router for navigation tests
jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react");
  const { Pressable } = require("react-native");

  const Link = React.forwardRef<
    unknown,
    { children?: ReactNode; href?: string } & Record<string, unknown>
  >(
    (
      {
        children,
        href,
        ...rest
      }: { children?: ReactNode; href?: string } & Record<string, unknown>,
      ref: Ref<unknown>
    ) => React.createElement(Pressable, { ref, ...rest }, children)
  );

  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn().mockReturnValue(false),
    }),
    useLocalSearchParams: () => ({}),
    usePathname: () => "/",
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn().mockReturnValue(false),
    },
    Link,
  };
});

// Global TodoService mock with simple synchronous behavior
jest.mock("./services/todoService", () => ({
  TodoService: {
    getAllTodos: jest.fn().mockResolvedValue([]),
    getTodoById: jest.fn().mockResolvedValue(null),
    createTodo: jest.fn().mockImplementation((input) => {
      const todo = {
        id: Date.now(),
        title: input.title,
        description: input.description || null,
        completed: false,
        priority: input.priority || 1,
        category: input.category || null,
        due_date: input.due_date || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return Promise.resolve(todo);
    }),
    updateTodo: jest.fn().mockImplementation((input) => {
      const updated = { ...input, updated_at: new Date().toISOString() };
      return Promise.resolve(updated);
    }),
    deleteTodo: jest.fn().mockResolvedValue(true),
    toggleCompleted: jest.fn().mockImplementation((id) => {
      const todo = {
        id,
        title: "Mock Todo",
        description: null,
        status: "completed",
        priority: 1,
        due_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return Promise.resolve(todo);
    }),
    toggleArchived: jest.fn().mockImplementation((id) => {
      const todo = {
        id,
        title: "Mock Todo",
        description: null,
        status: "archived",
        priority: 1,
        due_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return Promise.resolve(todo);
    }),
    getIncompleteTodos: jest.fn().mockResolvedValue([]),
    getCompletedTodos: jest.fn().mockResolvedValue([]),
    getTodosByPriority: jest.fn().mockResolvedValue([]),
    clearAllTodos: jest.fn().mockResolvedValue(undefined),
  },
}));
