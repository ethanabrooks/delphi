import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ConversationAgent } from "../services/conversationAgent";
import { platformTodoService } from "../services/platformTodoService";
import * as promptLoader from "../services/promptLoader";
import type { Todo } from "../types/todo";

// Mock the entire promptLoader module
jest.mock("../services/promptLoader");

// Mock platformTodoService
jest.mock("../services/platformTodoService", () => ({
  platformTodoService: {
    // biome-ignore lint/suspicious/noExplicitAny: mock factory cannot reference imported types
    getActiveTodos: (jest.fn() as any).mockResolvedValue([]),
  },
}));

// Mock OpenAI client
jest.mock("../services/openaiClient", () => ({
  __esModule: true,
  // biome-ignore lint/suspicious/noExplicitAny: mock factory cannot reference imported types
  default: (jest.fn() as any).mockImplementation(() => ({
    // biome-ignore lint/suspicious/noExplicitAny: mock factory cannot reference imported types
    createChatCompletion: (jest.fn() as any).mockResolvedValue({
      content: "Test response",
      tool_calls: undefined,
    }),
    // biome-ignore lint/suspicious/noExplicitAny: mock factory cannot reference imported types
    createResponse: (jest.fn() as any).mockRejectedValue(
      new Error("Not implemented")
    ),
  })),
  OpenAIClientError: class OpenAIClientError extends Error {
    isContextLengthError() {
      return false;
    }
  },
}));

describe("ConversationAgent error handling", () => {
  let agent: ConversationAgent;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    agent = new ConversationAgent("test-api-key");
    consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {}) as jest.SpiedFunction<typeof console.warn>;
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("buildSystemPrompt error handling", () => {
    test("uses fallback prompt when readSystemPromptTemplate throws", async () => {
      // Mock readSystemPromptTemplate to throw an error
      const mockReadSystemPromptTemplate = jest
        .spyOn(promptLoader, "readSystemPromptTemplate")
        .mockRejectedValue(new Error("Asset not found"));

      const response = await agent.processMessage("Hello");

      expect(mockReadSystemPromptTemplate).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to load system prompt template, using fallback:",
        expect.any(Error)
      );
      expect(response).toBe("Test response");

      mockReadSystemPromptTemplate.mockRestore();
    });

    test("fallback prompt includes current datetime", async () => {
      jest
        .spyOn(promptLoader, "readSystemPromptTemplate")
        .mockRejectedValue(new Error("Asset not found"));

      // Access the private buildSystemPrompt method for testing
      // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
      const systemPrompt = await (agent as any).buildSystemPrompt();

      expect(systemPrompt).toContain("You are a helpful AI assistant");
      expect(systemPrompt).toContain("todo list");
      expect(systemPrompt).toContain("The current date and time is:");
    });

    test("fallback prompt includes active todos context", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: mock setup requires any to bypass type constraints
      (platformTodoService.getActiveTodos as any).mockResolvedValue([
        {
          id: 1,
          title: "Test Todo",
          description: "Description",
          status: "active",
          priority: 1,
          due_date: undefined,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      ] as Todo[]);

      jest
        .spyOn(promptLoader, "readSystemPromptTemplate")
        .mockRejectedValue(new Error("Asset not found"));

      // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
      const systemPrompt = await (agent as any).buildSystemPrompt();

      expect(systemPrompt).toContain("Current Active Todos:");
      expect(systemPrompt).toContain("Test Todo");
    });
  });

  describe("compactConversation error handling", () => {
    test("uses fallback summarization prompt when readSummarizationPromptTemplate throws", async () => {
      // Set up conversation with many messages to trigger compaction
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Message 1" },
        { role: "assistant", content: "Response 1" },
        { role: "user", content: "Message 2" },
        { role: "assistant", content: "Response 2" },
        { role: "user", content: "Message 3" },
        { role: "assistant", content: "Response 3" },
        { role: "user", content: "Message 4" },
        { role: "assistant", content: "Response 4" },
        { role: "user", content: "Message 5" },
      ];

      const mockReadSummarizationPromptTemplate = jest
        .spyOn(promptLoader, "readSummarizationPromptTemplate")
        .mockRejectedValue(new Error("Asset not found"));

      jest
        .spyOn(promptLoader, "readSystemPromptTemplate")
        .mockResolvedValue("System prompt");

      // Trigger compaction by calling the private method
      // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
      await (agent as any).compactConversation(6);

      expect(mockReadSummarizationPromptTemplate).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to load summarization prompt template, using fallback:",
        expect.any(Error)
      );

      mockReadSummarizationPromptTemplate.mockRestore();
    });

    test("fallback summarization prompt includes conversation history", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const state = (agent as any).state;
      state.messages = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Message 1" },
        { role: "assistant", content: "Response 1" },
        { role: "user", content: "Message 2" },
        { role: "assistant", content: "Response 2" },
        { role: "user", content: "Message 3" },
        { role: "assistant", content: "Response 3" },
        { role: "user", content: "Message 4" },
        { role: "assistant", content: "Response 4" },
        { role: "user", content: "Message 5" },
      ];

      jest
        .spyOn(promptLoader, "readSummarizationPromptTemplate")
        .mockRejectedValue(new Error("Asset not found"));

      jest
        .spyOn(promptLoader, "readSystemPromptTemplate")
        .mockResolvedValue("System prompt");

      // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
      await (agent as any).compactConversation(6);

      // The client should have been called with a summarization request
      // biome-ignore lint/suspicious/noExplicitAny: accessing private client for testing
      const client = (agent as any).client;
      expect(client.createChatCompletion).toHaveBeenCalled();

      // Verify the call included the fallback summarization prompt structure
      const callArgs = client.createChatCompletion.mock.calls[0][0];
      const userMessage = callArgs.messages.find(
        (m: { role: string }) => m.role === "user"
      );
      expect(userMessage.content).toContain("concise summary");
      expect(userMessage.content).toContain("conversation history");
    });
  });

  describe("processMessage with prompt loading errors", () => {
    test("successfully processes message despite system prompt loading failure", async () => {
      jest
        .spyOn(promptLoader, "readSystemPromptTemplate")
        .mockRejectedValue(new Error("Asset not found"));

      const response = await agent.processMessage("Hello");

      expect(response).toBe("Test response");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to load system prompt template, using fallback:",
        expect.any(Error)
      );
    });

    test("conversation continues to work after template loading failure", async () => {
      jest
        .spyOn(promptLoader, "readSystemPromptTemplate")
        .mockRejectedValue(new Error("Asset not found"));

      const response1 = await agent.processMessage("First message");
      expect(response1).toBe("Test response");

      const response2 = await agent.processMessage("Second message");
      expect(response2).toBe("Test response");

      // biome-ignore lint/suspicious/noExplicitAny: accessing private state for testing
      const messageCount = (agent as any).state.messages.length;
      expect(messageCount).toBeGreaterThan(0);
    });
  });
});
