import OpenAIClient, { type ChatCompletionMessage } from "./openaiClient";
import { platformTodoService } from "./platformTodoService";
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
      messages: [],
    };
  }

  private async buildSystemPrompt(): Promise<string> {
    let activeTodosContext = "";

    try {
      const activeTodos = await platformTodoService.getActiveTodos();
      if (activeTodos.length > 0) {
        activeTodosContext = `\n\nCurrent Active Todos:
${activeTodos.map((todo) => `- Priority ${todo.priority}: "${todo.title}"${todo.description ? ` (${todo.description})` : ""}${todo.due_date ? ` - Due: ${todo.due_date}` : ""}`).join("\n")}`;
      } else {
        activeTodosContext = "\n\nCurrent Active Todos: None";
      }
    } catch (_error) {
      activeTodosContext = "\n\nCurrent Active Todos: Unable to load";
    }

    return `You are a helpful voice assistant that can manage todo items. You have access to a todo management system with the following functions: create_todo, update_todo, and toggle_todo.

IMPORTANT: You can see the complete list of active todos below. If a user tries to create a todo that already exists (similar or identical title), notify them that the todo already exists instead of creating a duplicate.

Available Functions:
- create_todo: Create a new todo item (check for duplicates first!)
- update_todo: Update an existing todo by priority number
- toggle_todo: Mark a todo as completed/active by priority number

${activeTodosContext}

When users ask about their todos or want to manage tasks, you can see all their active todos above. Use the available functions to help them manage tasks. Always be conversational and helpful.

Examples:
- "Add a todo to buy groceries" → Check if groceries todo exists first, then use create_todo if unique
- "Mark priority 5 as done" → use toggle_todo with priority 5
- "Update the first todo" → use update_todo with the priority number of the first todo shown above

Keep responses conversational and concise since this is a voice interface.`;
  }

  private async ensureSystemMessage(): Promise<void> {
    const systemPrompt = await this.buildSystemPrompt();

    // Update or add system message as the first message
    if (this.state.messages.length === 0) {
      this.state.messages.push({
        role: "system",
        content: systemPrompt,
      });
    } else if (this.state.messages[0].role === "system") {
      this.state.messages[0].content = systemPrompt;
    } else {
      this.state.messages.unshift({
        role: "system",
        content: systemPrompt,
      });
    }
  }

  async processMessage(userMessage: string): Promise<string> {
    if (!this.client) {
      return "I'm running in demo mode. Please add your OpenAI API key for full todo management functionality.";
    }

    // Ensure system message is up to date with current active todos
    await this.ensureSystemMessage();

    // Add user message to conversation
    this.state.messages.push({
      role: "user",
      content: userMessage,
    });

    try {
      // Try Responses API first if we have a conversation ID or it's the first try
      try {
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
          const followUpInput = `Tool execution results: ${toolResults.join(", ")}. Please provide a natural response to the user based on these results.`;

          const finalResponse = await this.client.createResponse({
            model: "gpt-4o",
            input: followUpInput,
            conversation: this.state.conversationId,
            max_tokens: 200,
          });

          const assistantResponse =
            finalResponse.output_text || "I've completed your request.";

          // Add final assistant response to conversation
          this.state.messages.push({
            role: "assistant",
            content: assistantResponse,
          });

          return assistantResponse;
        }

        const assistantResponse =
          response.output_text || "I'm sorry, I couldn't process that request.";

        // Add assistant response to conversation
        this.state.messages.push({
          role: "assistant",
          content: assistantResponse,
        });

        return assistantResponse;
      } catch (_responsesError) {
        // Fall back to Chat Completions API
        // Note: Responses API may not be available yet, using Chat Completions as fallback

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
          this.state.messages = [
            systemMessage,
            ...this.state.messages.slice(-9),
          ];
        }

        return assistantResponse;
      }
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

  async clearConversation(): Promise<void> {
    this.state.conversationId = undefined;
    this.state.messages = [];
    // System message will be rebuilt on next processMessage call
  }
}
