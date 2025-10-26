import { beforeEach, describe, expect, test } from "@jest/globals";
import { ConversationAgent } from "../services/conversationAgent";

describe("ConversationAgent lifecycle", () => {
  let agent: ConversationAgent;

  beforeEach(() => {
    agent = new ConversationAgent("test-api-key");
  });

  describe("dispose()", () => {
    test("clears conversation history", () => {
      // Manually add a message to simulate state
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      agent.dispose();

      expect(agent.getConversationHistory()).toEqual([]);
    });

    test("clears conversation ID", () => {
      // Manually set a conversation ID
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.conversationId = "test-conversation-id";

      agent.dispose();

      expect(agent.getConversationId()).toBeUndefined();
    });

    test("nulls out the client reference", () => {
      agent.dispose();

      // biome-ignore lint/suspicious/noExplicitAny: accessing private property for testing
      const client = (agent as any).client;
      expect(client).toBeNull();
    });

    test("leaves agent in clean state after disposal", () => {
      // Set up some state
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [{ role: "user", content: "Test" }];
      state.conversationId = "abc123";

      agent.dispose();

      expect(agent.getConversationHistory()).toEqual([]);
      expect(agent.getConversationId()).toBeUndefined();
      expect(agent.getMessageCount()).toBe(0);
      expect(agent.getLastMessage()).toBeUndefined();
    });
  });

  describe("clearConversation()", () => {
    test("clears messages but preserves client", async () => {
      // Manually add messages
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [{ role: "user", content: "Hello" }];
      state.conversationId = "test-id";

      await agent.clearConversation();

      expect(agent.getConversationHistory()).toEqual([]);
      expect(agent.getConversationId()).toBeUndefined();
      // Client should still be present (not null)
      // biome-ignore lint/suspicious/noExplicitAny: accessing private property for testing
      expect((agent as any).client).not.toBeNull();
    });
  });

  describe("getConversationState()", () => {
    test("returns readonly copy of state", () => {
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [{ role: "user", content: "Hello" }];
      state.conversationId = "test-id";

      const conversationState = agent.getConversationState();

      expect(conversationState.conversationId).toBe("test-id");
      expect(conversationState.messages).toHaveLength(1);
      expect(conversationState.messages[0].content).toBe("Hello");

      // Verify it's a copy (mutations don't affect original)
      conversationState.messages.push({ role: "assistant", content: "Hi" });
      expect(agent.getConversationHistory()).toHaveLength(1);
    });
  });

  describe("getMessageCount()", () => {
    test("returns zero for empty conversation", () => {
      expect(agent.getMessageCount()).toBe(0);
    });

    test("excludes system messages from count", () => {
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "system", content: "Another system message" },
      ];

      expect(agent.getMessageCount()).toBe(2);
    });

    test("counts user and assistant messages only", () => {
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [
        { role: "user", content: "First" },
        { role: "assistant", content: "Second" },
        { role: "user", content: "Third" },
      ];

      expect(agent.getMessageCount()).toBe(3);
    });
  });

  describe("getLastMessage()", () => {
    test("returns undefined for empty conversation", () => {
      expect(agent.getLastMessage()).toBeUndefined();
    });

    test("returns last user message when it's most recent", () => {
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [
        { role: "assistant", content: "Hello" },
        { role: "user", content: "Hi there" },
      ];

      const lastMessage = agent.getLastMessage();
      expect(lastMessage).toBeDefined();
      expect(lastMessage?.role).toBe("user");
      expect(lastMessage?.content).toBe("Hi there");
    });

    test("returns last assistant message when it's most recent", () => {
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      const lastMessage = agent.getLastMessage();
      expect(lastMessage).toBeDefined();
      expect(lastMessage?.role).toBe("assistant");
      expect(lastMessage?.content).toBe("Hi there");
    });

    test("ignores system messages when finding last message", () => {
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "system", content: "System update" },
      ];

      const lastMessage = agent.getLastMessage();
      expect(lastMessage).toBeDefined();
      expect(lastMessage?.role).toBe("assistant");
      expect(lastMessage?.content).toBe("Hi there");
    });
  });

  describe("multiple dispose calls", () => {
    test("can be called multiple times safely", () => {
      agent.dispose();
      agent.dispose();
      agent.dispose();

      expect(agent.getConversationHistory()).toEqual([]);
      expect(agent.getConversationId()).toBeUndefined();
    });
  });
});
