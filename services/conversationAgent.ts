import OpenAIClient, { type ChatCompletionMessage } from "./openaiClient";
import { executeTodoFunction, TODO_TOOLS } from "./todoTools";

export interface ConversationState {
  conversationId?: string;
  messages: ChatCompletionMessage[];
}

export class ConversationAgent {
  private client: OpenAIClient | null;
  private state: ConversationState;

  constructor(apiKey?: string) {
    this.client = apiKey ? new OpenAIClient(apiKey) : null;
    this.state = {
      conversationId: undefined,
      messages: [
        {
          role: "system",
          content: `You are a helpful voice assistant that can manage todo items. You have access to a comprehensive todo management system.

You can:
- Create, read, update, and delete todos
- Mark todos as completed or incomplete
- Filter todos by priority level (1=low, 2=medium, 3=high)
- Get statistics about todos
- Search and organize todos

When users ask about their todos or want to manage tasks, use the available functions to interact with their todo database. Always be conversational and helpful.

For example:
- "Add a todo to buy groceries" → use create_todo
- "Show me my incomplete tasks" → use get_incomplete_todos
- "Mark the first todo as done" → use get_all_todos first, then toggle_todo with the appropriate ID
- "What are my high priority tasks?" → use get_todos_by_priority with priority 3

Keep responses conversational and concise since this is a voice interface.`,
        },
      ],
    };
  }

  async processMessage(userMessage: string): Promise<string> {
    if (!this.client) {
      return "I'm running in demo mode. Please add your OpenAI API key for full todo management functionality.";
    }

    try {
      // Use the Responses API with conversation state
      const response = await this.client.createResponse({
        model: "gpt-4o",
        input: userMessage,
        tools: TODO_TOOLS,
        conversation: this.state.conversationId,
        max_tokens: 300,
      });

      // Store the conversation ID for future requests
      if (!this.state.conversationId) {
        this.state.conversationId = response.conversation;
      }

      // Handle tool calls if present
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Execute tool calls and collect results
        const toolResults: string[] = [];

        for (const toolCall of response.tool_calls) {
          const functionResult = await executeTodoFunction(
            toolCall.function.name,
            toolCall.function.arguments
          );
          toolResults.push(functionResult);
        }

        // Create a follow-up request with tool results
        // Note: With Responses API, tool execution is handled differently
        // We'll include the tool results in a follow-up message
        const followUpInput = `Tool execution results: ${toolResults.join(", ")}. Please provide a natural response to the user based on these results.`;

        const finalResponse = await this.client.createResponse({
          model: "gpt-4o",
          input: followUpInput,
          conversation: this.state.conversationId,
          max_tokens: 200,
        });

        return finalResponse.output_text || "I've completed your request.";
      }

      return (
        response.output_text || "I'm sorry, I couldn't process that request."
      );
    } catch (_error) {
      return "I'm sorry, I encountered an error processing your request. Please try again.";
    }
  }

  getConversationHistory(): ChatCompletionMessage[] {
    return [...this.state.messages];
  }

  getConversationId(): string | undefined {
    return this.state.conversationId;
  }

  clearConversation(): void {
    this.state.conversationId = undefined;
    this.state.messages = [this.state.messages[0]]; // Keep system message
  }
}
