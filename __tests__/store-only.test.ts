import { beforeEach, describe, expect, test } from "@jest/globals";
import { useTodoStore } from "../stores/simpleTodoStore";

describe("Store Only Test", () => {
  beforeEach(() => {
    useTodoStore.setState({
      todos: [],
      isLoading: false,
      error: null,
    });
  });

  test("should import and use the store", () => {
    const state = useTodoStore.getState();
    expect(state.todos).toEqual([]);
    expect(state.isLoading).toBe(false);
  });
});
