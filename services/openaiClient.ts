import { z } from "zod";

const OPENAI_BASE_URL = "https://api.openai.com";

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type ResponsesInput = {
  role?: "user";
  content: string;
  attachments?: unknown[];
};

export type ResponsesParams = {
  model: string;
  input: ResponsesInput | string;
  tools?: Tool[];
  conversation?: string;
  background?: boolean;
  max_tokens?: number;
};

export type ResponsesResult = {
  id: string;
  conversation: string;
  output_text: string;
  tool_calls?: ToolCall[];
  status: "completed" | "in_progress" | "failed";
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

export interface ChatCompletionParams {
  model: string;
  messages: ChatCompletionMessage[];
  maxTokens?: number;
  tools?: Tool[];
  tool_choice?:
    | "auto"
    | "none"
    | { type: "function"; function: { name: string } };
}

export interface ChatCompletionResult {
  content: string | null;
  tool_calls?: ToolCall[];
}

export interface TranscriptionResult {
  text: string;
}

export class OpenAIClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "OpenAIClientError";
  }
}

const transcriptionSchema = z.object({
  text: z.string(),
});

const toolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
          tool_calls: z.array(toolCallSchema).optional(),
        }),
      })
    )
    .min(1, "OpenAI response did not include any choices"),
});

const responsesSchema = z.object({
  id: z.string(),
  conversation: z.string(),
  output_text: z.string(),
  tool_calls: z.array(toolCallSchema).optional(),
  status: z.enum(["completed", "in_progress", "failed"]),
});

function parseTranscription(json: unknown): TranscriptionResult {
  const result = transcriptionSchema.safeParse(json);

  if (!result.success) {
    throw new OpenAIClientError(
      "Invalid transcription payload returned by OpenAI",
      undefined,
      result.error
    );
  }

  return result.data;
}

function parseChatCompletion(json: unknown): ChatCompletionResult {
  const result = chatCompletionSchema.safeParse(json);

  if (!result.success) {
    throw new OpenAIClientError(
      "Invalid chat completion payload returned by OpenAI",
      undefined,
      result.error
    );
  }

  const [
    {
      message: { content, tool_calls },
    },
  ] = result.data.choices;

  return { content, tool_calls };
}

function parseResponses(json: unknown): ResponsesResult {
  const result = responsesSchema.safeParse(json);

  if (!result.success) {
    throw new OpenAIClientError(
      "Invalid responses payload returned by OpenAI",
      undefined,
      result.error
    );
  }

  return result.data;
}

function buildHeaders(apiKey: string, extra?: HeadersInit): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...extra,
  };
}

export class OpenAIClient {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new OpenAIClientError(
        "API key is required to initialise OpenAIClient"
      );
    }
  }

  async createTranscription(formData: FormData): Promise<TranscriptionResult> {
    const response = await fetch(`${OPENAI_BASE_URL}/v1/audio/transcriptions`, {
      method: "POST",
      headers: buildHeaders(this.apiKey),
      body: formData,
    });

    const payload = await this.parseJson(response);
    return parseTranscription(payload);
  }

  async createChatCompletion({
    model,
    messages,
    maxTokens,
    tools,
    tool_choice,
  }: ChatCompletionParams): Promise<ChatCompletionResult> {
    const requestBody: {
      model: string;
      messages: ChatCompletionMessage[];
      max_tokens?: number;
      tools?: Tool[];
      tool_choice?:
        | "auto"
        | "none"
        | { type: "function"; function: { name: string } };
    } = {
      model,
      messages,
      max_tokens: maxTokens,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      if (tool_choice) {
        requestBody.tool_choice = tool_choice;
      }
    }

    const response = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: buildHeaders(this.apiKey, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(requestBody),
    });

    const payload = await this.parseJson(response);
    return parseChatCompletion(payload);
  }

  async createResponse({
    model,
    input,
    tools,
    conversation,
    background = false,
    max_tokens,
  }: ResponsesParams): Promise<ResponsesResult> {
    const requestBody: {
      model: string;
      input: ResponsesInput | string;
      tools?: Tool[];
      conversation?: string;
      background?: boolean;
      max_tokens?: number;
    } = {
      model,
      input,
      background,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    if (conversation) {
      requestBody.conversation = conversation;
    }

    if (max_tokens) {
      requestBody.max_tokens = max_tokens;
    }

    const response = await fetch(`${OPENAI_BASE_URL}/v1/responses`, {
      method: "POST",
      headers: buildHeaders(this.apiKey, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(requestBody),
    });

    const payload = await this.parseJson(response);
    return parseResponses(payload);
  }

  private async parseJson(response: Response): Promise<unknown> {
    if (!response.ok) {
      const detail = await this.safeReadErrorBody(response);
      throw new OpenAIClientError(
        `OpenAI request failed with status ${response.status}`,
        response.status,
        detail
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new OpenAIClientError(
        "Failed to parse OpenAI response as JSON",
        response.status,
        error
      );
    }
  }

  private async safeReadErrorBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
}

export default OpenAIClient;
