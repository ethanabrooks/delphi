import { z } from "zod";

const OPENAI_BASE_URL = "https://api.openai.com";

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface ChatCompletionParams {
  model: string;
  messages: ChatCompletionMessage[];
  maxTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
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

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string(),
        }),
      })
    )
    .min(1, "OpenAI response did not include any choices"),
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
      message: { content },
    },
  ] = result.data.choices;

  return { content };
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
  }: ChatCompletionParams): Promise<ChatCompletionResult> {
    const response = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: buildHeaders(this.apiKey, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
      }),
    });

    const payload = await this.parseJson(response);
    return parseChatCompletion(payload);
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
