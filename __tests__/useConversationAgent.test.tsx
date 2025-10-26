import { describe, expect, jest, test } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import {
  type UseConversationAgentResult,
  useConversationAgent,
} from "../hooks/useConversationAgent";
import { ConversationAgent } from "../services/conversationAgent";

describe("useConversationAgent", () => {
  describe("initialization", () => {
    test("creates agent on mount", () => {
      const { result } = renderHook(() =>
        useConversationAgent({ apiKey: "test-key" })
      );

      expect(result.current.agent).toBeInstanceOf(ConversationAgent);
    });

    test("initializes with empty state", () => {
      const { result } = renderHook(() =>
        useConversationAgent({ apiKey: "test-key" })
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.conversationId).toBeUndefined();
      expect(result.current.messageCount).toBe(0);
      expect(result.current.lastMessage).toBeUndefined();
    });

    test("works without API key", () => {
      const { result } = renderHook(() => useConversationAgent({}));

      expect(result.current.agent).toBeInstanceOf(ConversationAgent);
    });
  });

  describe("cleanup on unmount", () => {
    test("calls dispose when component unmounts", () => {
      const { result, unmount } = renderHook(() =>
        useConversationAgent({ apiKey: "test-key" })
      );

      const disposeSpy = jest.spyOn(result.current.agent, "dispose");

      unmount();

      expect(disposeSpy).toHaveBeenCalledTimes(1);
    });

    test("clears conversation state on unmount", () => {
      const { result, unmount } = renderHook(() =>
        useConversationAgent({ apiKey: "test-key" })
      );

      // Manually add state to the agent
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (result.current.agent as any).state;
      state.messages = [{ role: "user", content: "Test" }];
      state.conversationId = "test-id";

      unmount();

      // Verify the agent was cleaned up
      expect(result.current.agent.getConversationHistory()).toEqual([]);
    });
  });

  describe("apiKey changes", () => {
    test("creates new agent when apiKey changes", () => {
      const { result, rerender } = renderHook<
        UseConversationAgentResult,
        { apiKey: string }
      >(({ apiKey }) => useConversationAgent({ apiKey }), {
        initialProps: { apiKey: "key1" },
      });

      const firstAgent = result.current.agent;

      rerender({ apiKey: "key2" });

      const secondAgent = result.current.agent;
      expect(secondAgent).not.toBe(firstAgent);
    });

    test("disposes old agent when apiKey changes", () => {
      const { result, rerender } = renderHook<
        UseConversationAgentResult,
        { apiKey: string }
      >(({ apiKey }) => useConversationAgent({ apiKey }), {
        initialProps: { apiKey: "key1" },
      });

      const firstAgent = result.current.agent;
      const disposeSpy = jest.spyOn(firstAgent, "dispose");

      rerender({ apiKey: "key2" });

      expect(disposeSpy).toHaveBeenCalledTimes(1);
    });

    test("new agent has clean state after key change", () => {
      const { result, rerender } = renderHook<
        UseConversationAgentResult,
        { apiKey: string }
      >(({ apiKey }) => useConversationAgent({ apiKey }), {
        initialProps: { apiKey: "key1" },
      });

      // Add state to first agent
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const firstState = (result.current.agent as any).state;
      firstState.messages = [{ role: "user", content: "Test" }];
      firstState.conversationId = "old-id";

      rerender({ apiKey: "key2" });

      // New agent should have clean state
      expect(result.current.messages).toEqual([]);
      expect(result.current.conversationId).toBeUndefined();
    });
  });

  describe("clearConversation()", () => {
    test("clears conversation through wrapper", async () => {
      const { result } = renderHook(() =>
        useConversationAgent({ apiKey: "test-key" })
      );

      // Add state
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (result.current.agent as any).state;
      state.messages = [{ role: "user", content: "Test" }];
      state.conversationId = "test-id";

      await result.current.clearConversation();

      // State should be cleared
      expect(result.current.agent.getConversationHistory()).toEqual([]);
      expect(result.current.agent.getConversationId()).toBeUndefined();
    });
  });

  describe("state exposure", () => {
    test("exposes conversationId from agent", () => {
      const { result } = renderHook(() =>
        useConversationAgent({ apiKey: "test-key" })
      );

      // Set conversation ID
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (result.current.agent as any).state;
      state.conversationId = "test-id-123";

      // Need to trigger a re-render by calling a wrapped method
      // In real usage, this would happen naturally after processMessage
      expect(result.current.agent.getConversationId()).toBe("test-id-123");
    });

    test("exposes messageCount from agent", () => {
      const { result } = renderHook(() =>
        useConversationAgent({ apiKey: "test-key" })
      );

      // Add messages
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (result.current.agent as any).state;
      state.messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ];

      expect(result.current.agent.getMessageCount()).toBe(2);
    });

    test("exposes lastMessage from agent", () => {
      const { result } = renderHook(() =>
        useConversationAgent({ apiKey: "test-key" })
      );

      // Add messages
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (result.current.agent as any).state;
      state.messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      const lastMessage = result.current.agent.getLastMessage();
      expect(lastMessage?.content).toBe("Hi there");
    });
  });

  describe("multiple instances", () => {
    test("each hook instance gets its own agent", () => {
      const { result: result1 } = renderHook(() =>
        useConversationAgent({ apiKey: "key1" })
      );
      const { result: result2 } = renderHook(() =>
        useConversationAgent({ apiKey: "key2" })
      );

      expect(result1.current.agent).not.toBe(result2.current.agent);
    });

    test("unmounting one instance does not affect another", () => {
      const { unmount: unmount1 } = renderHook(() =>
        useConversationAgent({ apiKey: "key1" })
      );
      const { result: result2 } = renderHook(() =>
        useConversationAgent({ apiKey: "key2" })
      );

      const agent2 = result2.current.agent;
      const disposeSpy2 = jest.spyOn(agent2, "dispose");

      unmount1();

      // Agent 2 should not be disposed
      expect(disposeSpy2).not.toHaveBeenCalled();
    });
  });
});
