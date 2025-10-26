import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Mock promptLoader before importing conversationAgent
const mockReadSystemPromptTemplate =
  jest.fn<(variables: Record<string, string>) => Promise<string>>();
const mockReadSummarizationPromptTemplate =
  jest.fn<(variables: Record<string, string>) => Promise<string>>();

jest.mock("../services/promptLoader", () => ({
  readSystemPromptTemplate: (variables: Record<string, string>) =>
    mockReadSystemPromptTemplate(variables),
  readSummarizationPromptTemplate: (variables: Record<string, string>) =>
    mockReadSummarizationPromptTemplate(variables),
}));

// Mock platformTodoService
const mockGetActiveTodos = jest.fn<() => Promise<unknown[]>>();

jest.mock("../services/platformTodoService", () => ({
  platformTodoService: {
    getActiveTodos: () => mockGetActiveTodos(),
  },
}));

// Mock OpenAI client
const mockCreateResponse = jest.fn<() => Promise<any>>();
const mockCreateChatCompletion = jest.fn<() => Promise<any>>();

jest.mock("../services/openaiClient", () => {
  const actualModule = jest.requireActual<
    typeof import("../services/openaiClient")
  >("../services/openaiClient");

  // Mock constructor function
  const MockOpenAIClient = jest.fn().mockImplementation(() => ({
    createResponse: mockCreateResponse,
    createChatCompletion: mockCreateChatCompletion,
  }));

  return {
    ...actualModule,
    __esModule: true,
    default: MockOpenAIClient,
    OpenAIClientError: actualModule.OpenAIClientError,
  };
});

import { ConversationAgent } from "../services/conversationAgent";

describe("ConversationAgent prompt loading error handling", () => {
  beforeEach(() => {
    mockReadSystemPromptTemplate.mockReset();
    mockReadSummarizationPromptTemplate.mockReset();
    mockGetActiveTodos.mockReset();
    mockCreateResponse.mockReset();
    mockCreateChatCompletion.mockReset();

    // Default successful behavior
    mockGetActiveTodos.mockResolvedValue([]);
    mockReadSystemPromptTemplate.mockResolvedValue(
      "System prompt from template"
    );
    mockReadSummarizationPromptTemplate.mockResolvedValue(
      "Summarization prompt from template"
    );
  });

  test("buildSystemPrompt falls back to default prompt when template loading fails", async () => {
    // Mock template loading failure
    mockReadSystemPromptTemplate.mockRejectedValue(
      new Error("Failed to load template")
    );

    // Mock successful API response
    mockCreateResponse.mockResolvedValue({
      conversation: "conv-123",
      output_text: "Hello! I'm your assistant.",
      tool_calls: [],
    });

    const agent = new ConversationAgent("test-api-key");

    const response = await agent.processMessage("Hello");

    expect(response).toBe("Hello! I'm your assistant.");
    expect(mockReadSystemPromptTemplate).toHaveBeenCalledTimes(1);

    // Verify fallback prompt was used by checking conversation history
    const history = agent.getConversationHistory();
    expect(history[0].role).toBe("system");
    expect(history[0].content).toContain("helpful AI assistant");
    expect(history[0].content).toContain("todo list");
  });

  test("buildSystemPrompt includes active todos context in fallback prompt", async () => {
    mockGetActiveTodos.mockResolvedValue([
      {
        id: 1,
        title: "Test todo",
        description: "Description",
        status: "active",
        priority: 1,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        due_date: null,
      },
    ]);

    mockReadSystemPromptTemplate.mockRejectedValue(
      new Error("Asset loading failed")
    );

    mockCreateResponse.mockResolvedValue({
      conversation: "conv-456",
      output_text: "Task created successfully.",
      tool_calls: [],
    });

    const agent = new ConversationAgent("test-api-key");

    await agent.processMessage("Create a task");

    const history = agent.getConversationHistory();
    expect(history[0].content).toContain("Current Active Todos:");
    expect(history[0].content).toContain("Test todo");
  });

  test("compactConversation uses fallback prompt when summarization template loading fails", async () => {
    // Mock summarization template failure
    mockReadSummarizationPromptTemplate.mockRejectedValue(
      new Error("Failed to load summarization template")
    );

    // Mock chat completion for summarization
    mockCreateChatCompletion.mockResolvedValue({
      content: "Summarized history",
      tool_calls: [],
    });

    const agent = new ConversationAgent("test-api-key");

    // Set up conversation state with enough messages to compact
    const agentWithState = agent as unknown as {
      state: { messages: unknown[] };
      compactConversation: (keepRecentCount?: number) => Promise<void>;
    };

    agentWithState.state.messages = [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Old message 1" },
      { role: "assistant", content: "Old response 1" },
      { role: "user", content: "Recent message 1" },
      { role: "assistant", content: "Recent response 1" },
      { role: "user", content: "Recent message 2" },
      { role: "assistant", content: "Recent response 2" },
      { role: "user", content: "Recent message 3" },
    ];

    // Call private compactConversation method directly
    await agentWithState.compactConversation(6);

    // Verify summarization template was attempted
    expect(mockReadSummarizationPromptTemplate).toHaveBeenCalled();

    // Verify the fallback prompt was used despite template failure
    expect(mockCreateChatCompletion).toHaveBeenCalled();
    expect(mockCreateChatCompletion.mock.calls.length).toBeGreaterThan(0);

    // Type assertion for mock call arguments (using unknown to bypass strict type checking)
    const calls = mockCreateChatCompletion.mock.calls as unknown as Array<
      [{ messages: Array<{ content: string }> }]
    >;
    expect(calls[0]).toBeDefined();
    expect(calls[0][0].messages[1]?.content).toContain(
      "concise summary of the following conversation history"
    );
  });

  test("agent continues to function normally when templates load successfully", async () => {
    mockReadSystemPromptTemplate.mockResolvedValue(
      "Custom system prompt with {{currentDateTime}} and {{activeTodosContext}}"
    );

    mockCreateResponse.mockResolvedValue({
      conversation: "conv-success",
      output_text: "All working perfectly!",
      tool_calls: [],
    });

    const agent = new ConversationAgent("test-api-key");

    const response = await agent.processMessage("Test message");

    expect(response).toBe("All working perfectly!");
    expect(mockReadSystemPromptTemplate).toHaveBeenCalledTimes(1);
    expect(mockReadSystemPromptTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        currentDateTime: expect.any(String),
        activeTodosContext: expect.any(String),
      })
    );
  });

  test("fallback prompt maintains essential functionality when template unavailable", async () => {
    mockReadSystemPromptTemplate.mockRejectedValue(
      new Error("Template not found")
    );

    mockCreateResponse.mockResolvedValue({
      conversation: "conv-fallback",
      output_text: "Using fallback successfully",
      tool_calls: [],
    });

    const agent = new ConversationAgent("test-api-key");

    const response = await agent.processMessage("Can you help me?");

    expect(response).toBe("Using fallback successfully");

    const history = agent.getConversationHistory();
    const systemMessage = history[0];

    // Verify fallback contains essential information
    expect(systemMessage.content).toContain("helpful AI assistant");
    expect(systemMessage.content).toContain("manages a todo list");
    expect(systemMessage.content).toMatch(/current date and time/i);
  });
});
