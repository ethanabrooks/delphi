import OpenAIClient, { type ChatCompletionMessage } from "./openaiClient";
import { executeTodoFunction, TODO_TOOLS } from "./todoTools";

export interface ConversationState {
  messages: ChatCompletionMessage[];
}

export class ConversationAgent {
  private client: OpenAIClient | null;
  private state: ConversationState;

  constructor(apiKey?: string) {
    this.client = apiKey ? new OpenAIClient(apiKey) : null;
    this.state = {
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

    // Add user message to conversation
    this.state.messages.push({
      role: "user",
      content: userMessage,
    });

    try {
      let response = await this.client.createChatCompletion({
        model: "gpt-4o",
        messages: this.state.messages,
        maxTokens: 300,
        tools: TODO_TOOLS,
        tool_choice: "auto",
      });

      // Handle function calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Add assistant message with tool calls
        this.state.messages.push({
          role: "assistant",
          content: response.content,
          tool_calls: response.tool_calls,
        });

        // Execute each tool call
        for (const toolCall of response.tool_calls) {
          const functionResult = await executeTodoFunction(
            toolCall.function.name,
            toolCall.function.arguments
          );

          // Add tool result to conversation
          this.state.messages.push({
            role: "tool",
            content: functionResult,
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
          });
        }

        // Get final response after function execution
        response = await this.client.createChatCompletion({
          model: "gpt-4o",
          messages: this.state.messages,
          maxTokens: 200,
        });
      }

      const assistantResponse =
        response.content || "I'm sorry, I couldn't process that request.";

      // Add final assistant response to conversation
      this.state.messages.push({
        role: "assistant",
        content: assistantResponse,
      });

      // Keep conversation history manageable (last 10 messages)
      if (this.state.messages.length > 10) {
        const systemMessage = this.state.messages[0];
        this.state.messages = [systemMessage, ...this.state.messages.slice(-9)];
      }

      return assistantResponse;
    } catch (_error) {
      // Note: Error occurred during conversation processing
      return "I'm sorry, I encountered an error processing your request. Please try again.";
    }
  }

  getConversationHistory(): ChatCompletionMessage[] {
    return [...this.state.messages];
  }

  clearConversation(): void {
    this.state.messages = [this.state.messages[0]]; // Keep system message
  }
}
