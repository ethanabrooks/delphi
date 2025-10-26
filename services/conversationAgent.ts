import OpenAIClient, { type ChatCompletionMessage } from "./openaiClient";
import { platformTodoService } from "./platformTodoService";
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
        activeTodosContext = `\n\nCurrent Active Todos:
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

    return `You are a helpful voice assistant that can manage todo items and analyze todo data. You have access to a todo management system with the following functions: create_todo, update_todo, and SQL database querying capabilities.

Current date and time: ${new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })}

IMPORTANT: You can see the complete list of active todos below. If a user tries to create a todo that already exists (similar or identical title), notify them that the todo already exists instead of creating a duplicate.

Available Functions:
- create_todo: Create a new todo item (check for duplicates first!)
- update_todo: Update an existing todo by ID number (can change status to completed/active/archived)
- execute_sql_query: Run custom SQL queries to analyze todo data, generate statistics, or perform advanced searches

DATABASE SCHEMA:
Table: todos
- id: INTEGER PRIMARY KEY (auto-increment)
- priority: INTEGER (position in active list, lower = higher priority)
- title: TEXT (todo title/description)
- description: TEXT (optional longer description)
- status: TEXT ('active', 'completed', 'archived')
- due_date: TEXT (ISO date string, optional)
- created_at: TEXT (ISO datetime string)
- updated_at: TEXT (ISO datetime string)

${activeTodosContext}

When users ask about their todos or want to manage tasks, you can see all their active todos above. Use the available functions to help them manage tasks. Always be conversational and helpful.

Examples:
- "Add a todo to buy groceries" → Check if groceries todo exists first, then use create_todo if unique
- "Mark ID 5 as done" → use update_todo with id 5 and newStatus: "completed"
- "Update the first active todo" → use update_todo with the ID of the first active todo shown above
- "How many todos do I have by status?" → use execute_sql_query with "SELECT status, COUNT(*) as count FROM todos GROUP BY status"
- "Show me todos created this week" → use execute_sql_query with date filtering
- "What completed todos do I have?" → Look at the active todos above or use execute_sql_query

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

      let response = await this.client.createChatCompletion({
        model: "gpt-4o",
        messages: this.state.messages,
        maxTokens: 300,
        tools: _ALL_TOOLS,
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
