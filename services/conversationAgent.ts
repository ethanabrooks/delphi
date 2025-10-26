import OpenAIClient, {
  type ChatCompletionMessage,
  OpenAIClientError,
} from "./openaiClient";
import { platformTodoService } from "./platformTodoService";
import {
  readSummarizationPromptTemplate,
  readSystemPromptTemplate,
} from "./promptLoader";
import { executeSqlFunction, SQL_TOOLS } from "./sqlTools";
import { executeTodoFunction, TODO_TOOLS } from "./todoTools";

// Combine todo tools and SQL tools
const _ALL_TOOLS = [...TODO_TOOLS, ...SQL_TOOLS];

// SQL tool names for routing
const SQL_TOOL_NAMES = ["execute_sql_query"];

// Unified tool execution function
async function _executeToolFunction(
  name: string,
  args: string
): Promise<string> {
  if (SQL_TOOL_NAMES.includes(name)) {
    return executeSqlFunction(name, args);
  } else {
    return executeTodoFunction(name, args);
  }
}

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
        activeTodosContext = `

Current Active Todos:
 id | priority |      title       |   description   | status  | due_date  |     created_at      |     updated_at
----+----------+------------------+-----------------+---------+-----------+---------------------+---------------------
${activeTodos
  .map((todo) => {
    const id = todo.id.toString().padEnd(3);
    const priority = todo.priority.toString().padEnd(8);
    const title = (
      todo.title.length > 16 ? `${todo.title.substring(0, 13)}...` : todo.title
    ).padEnd(16);
    const description = (
      todo.description
        ? todo.description.length > 13
          ? `${todo.description.substring(0, 10)}...`
          : todo.description
        : "NULL"
    ).padEnd(15);
    const status = todo.status.padEnd(7);
    const dueDate = (todo.due_date?.substring(0, 10) ?? "NULL").padEnd(9);
    const createdAt = todo.created_at.substring(0, 19).padEnd(19);
    const updatedAt = todo.updated_at.substring(0, 19).padEnd(19);
    return ` ${id}| ${priority} | ${title} | ${description} | ${status} | ${dueDate} | ${createdAt} | ${updatedAt}`;
  })
  .join("\n")}
(${activeTodos.length} rows)`;
      } else {
        activeTodosContext = "\n\nCurrent Active Todos: None";
      }
    } catch (_error) {
      activeTodosContext = "\n\nCurrent Active Todos: Unable to load";
    }

    const currentDateTime = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    try {
      return await readSystemPromptTemplate({
        currentDateTime,
        activeTodosContext,
      });
    } catch (_error) {
      return `You are a helpful AI assistant that manages a todo list. The current date and time is: ${currentDateTime}.${activeTodosContext}

You have access to tools to help users manage their todos. Be concise and helpful.`;
    }
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

  private async compactConversation(
    keepRecentCount: number = 6
  ): Promise<void> {
    if (this.state.messages.length <= keepRecentCount + 1) {
      return; // Nothing to compact
    }

    const systemMessage = this.state.messages[0];
    const recentMessages = this.state.messages.slice(-keepRecentCount);
    const oldMessages = this.state.messages.slice(1, -keepRecentCount);

    if (oldMessages.length === 0) {
      return; // Nothing to summarize
    }

    // Format conversation history for summarization
    const conversationHistory = oldMessages
      .map((m) => `${m.role}: ${m.content || "[tool call]"}`)
      .join("\n");

    // Load the summarization prompt template with fallback
    let summarizationPrompt: string;
    try {
      summarizationPrompt = await readSummarizationPromptTemplate({
        conversationHistory,
      });
    } catch (_error) {
      summarizationPrompt = `Please provide a concise summary of the following conversation history in 2-3 sentences, focusing on key decisions, actions taken, and important context:\n\n${conversationHistory}`;
    }

    const summaryResponse = await this.client?.createChatCompletion({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates concise conversation summaries.",
        },
        {
          role: "user",
          content: summarizationPrompt,
        },
      ],
      maxTokens: 200,
    });

    const summary =
      summaryResponse?.content || "Previous conversation context.";

    // Replace old messages with summary
    this.state.messages = [
      systemMessage,
      {
        role: "system",
        content: `[Summary of earlier conversation]: ${summary}`,
      },
      ...recentMessages,
    ];
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

    // Try Responses API first if we have a conversation ID or it's the first try
    try {
      const response = await this.client.createResponse({
        model: "gpt-4o",
        input: userMessage,
        tools: _ALL_TOOLS,
        conversation: this.state.conversationId,
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
          const functionResult = await _executeToolFunction(
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

      return await this.processChatCompletion();
    }
  }

  private async processChatCompletion(): Promise<string> {
    try {
      let response = await this.client?.createChatCompletion({
        model: "gpt-4o",
        messages: this.state.messages,
        maxTokens: 300,
        tools: _ALL_TOOLS,
        tool_choice: "auto",
      });

      // Handle function calls
      if (response?.tool_calls && response.tool_calls.length > 0) {
        // Add assistant message with tool calls
        this.state.messages.push({
          role: "assistant",
          content: response.content,
          tool_calls: response.tool_calls,
        });

        // Execute each tool call
        for (const toolCall of response.tool_calls) {
          const functionResult = await _executeToolFunction(
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
        response = await this.client?.createChatCompletion({
          model: "gpt-4o",
          messages: this.state.messages,
          maxTokens: 200,
        });
      }

      const assistantResponse =
        response?.content || "I'm sorry, I couldn't process that request.";

      // Add final assistant response to conversation
      this.state.messages.push({
        role: "assistant",
        content: assistantResponse,
      });

      return assistantResponse;
    } catch (error) {
      // If we hit context length limit, compact and retry once
      if (error instanceof OpenAIClientError && error.isContextLengthError()) {
        await this.compactConversation();
        return await this.processChatCompletionAfterCompaction();
      }
      throw error;
    }
  }

  private async processChatCompletionAfterCompaction(): Promise<string> {
    let response = await this.client?.createChatCompletion({
      model: "gpt-4o",
      messages: this.state.messages,
      maxTokens: 300,
      tools: _ALL_TOOLS,
      tool_choice: "auto",
    });

    // Handle function calls
    if (response?.tool_calls && response.tool_calls.length > 0) {
      // Add assistant message with tool calls
      this.state.messages.push({
        role: "assistant",
        content: response.content,
        tool_calls: response.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        const functionResult = await _executeToolFunction(
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
      response = await this.client?.createChatCompletion({
        model: "gpt-4o",
        messages: this.state.messages,
        maxTokens: 200,
      });
    }

    const assistantResponse =
      response?.content || "I'm sorry, I couldn't process that request.";

    // Add final assistant response to conversation
    this.state.messages.push({
      role: "assistant",
      content: assistantResponse,
    });

    return assistantResponse;
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

  /**
   * Dispose of the agent, clearing all state and releasing resources.
   * Should be called when the agent is no longer needed (e.g., on component unmount).
   */
  dispose(): void {
    this.state.conversationId = undefined;
    this.state.messages = [];
    this.client = null;
  }

  /**
   * Get the current conversation state for observation.
   */
  getConversationState(): Readonly<ConversationState> {
    return {
      conversationId: this.state.conversationId,
      messages: [...this.state.messages],
    };
  }

  /**
   * Get the count of messages in the conversation (excluding system messages).
   */
  getMessageCount(): number {
    return this.state.messages.filter((m) => m.role !== "system").length;
  }

  /**
   * Get the last user or assistant message, if any.
   */
  getLastMessage(): ChatCompletionMessage | undefined {
    const nonSystemMessages = this.state.messages.filter(
      (m) => m.role === "user" || m.role === "assistant"
    );
    return nonSystemMessages.length > 0
      ? nonSystemMessages[nonSystemMessages.length - 1]
      : undefined;
  }
}
