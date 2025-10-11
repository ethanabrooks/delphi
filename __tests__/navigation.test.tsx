import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Text } = require("react-native");

  const screenSpy = jest.fn();
  const tabsSpy = jest.fn();

  const Tabs = ({
    children,
    ...rest
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => {
    tabsSpy(rest);
    return <>{children}</>;
  };

  Tabs.Screen = ({ name, options }: { name: string; options?: unknown }) => {
    screenSpy({ name, options });
    return null;
  };

  return {
    Tabs,
    Redirect: ({ href }: { href: string }) => (
      <Text testID="redirect-target">{href}</Text>
    ),
    __tabsSpy: tabsSpy,
    __screenSpy: screenSpy,
  };
});

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

const { __tabsSpy, __screenSpy } = jest.requireMock("expo-router") as {
  __tabsSpy: jest.Mock;
  __screenSpy: jest.Mock;
};

// Components must be imported after mocks are defined.
import RootLayout from "../app/_layout";
import IndexRoute from "../app/index";

describe("navigation", () => {
  beforeEach(() => {
    __tabsSpy.mockClear();
    __screenSpy.mockClear();
  });

  test("root layout registers talk and todo tabs", () => {
    render(<RootLayout />);

    const screenCalls = __screenSpy.mock.calls.map(
      ([payload]) => payload as { name: string; options?: unknown }
    );
    expect(screenCalls.map((call) => call.name)).toEqual(["talk", "todo"]);
    expect(__tabsSpy).toHaveBeenCalled();
  });

  test("index route redirects to talk", () => {
    const { getByTestId } = render(<IndexRoute />);

    expect(getByTestId("redirect-target").props.children).toBe("/talk");
  });
});
