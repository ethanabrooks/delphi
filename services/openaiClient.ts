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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ensureString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseTranscription(json: unknown): TranscriptionResult {
  if (!isRecord(json)) {
    throw new OpenAIClientError("Invalid transcription payload shape");
  }

  const text = ensureString(json.text);

  if (!text) {
    throw new OpenAIClientError("Transcription payload missing text field");
  }

  return { text };
}

function parseChatCompletion(json: unknown): ChatCompletionResult {
  if (!isRecord(json)) {
    throw new OpenAIClientError("Invalid chat completion payload shape");
  }

  const choices = json.choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenAIClientError("Chat completion payload missing choices");
  }

  const firstChoice = choices[0];

  if (!isRecord(firstChoice)) {
    throw new OpenAIClientError("Chat completion choice is not an object");
  }

  const message = firstChoice.message;

  if (!isRecord(message)) {
    throw new OpenAIClientError("Chat completion choice missing message");
  }

  const content = ensureString(message.content);

  if (!content) {
    throw new OpenAIClientError("Chat completion message missing content");
  }

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
