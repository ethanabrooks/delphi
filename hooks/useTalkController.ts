import { useCallback, useEffect, useMemo, useState } from "react";
import OpenAIClient, {
  type ChatCompletionMessage,
} from "../services/openaiClient";
import voiceService, { type VoiceRecording } from "../services/voiceService";

interface UseTalkControllerOptions {
  apiKey?: string;
  customProcessor?: (transcript: string) => Promise<string>;
}

interface UseTalkControllerResult {
  isSupported: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  response: string;
  errorMessage: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  handlePress: () => Promise<void>;
  clearError: () => void;
}

const DEMO_TRANSCRIPT = "Hello! This is a demo recording.";
const DEMO_RESPONSE =
  "I heard you say: Hello! This is a demo recording. How can I help you today?";

export function useTalkController({
  apiKey,
  customProcessor,
}: UseTalkControllerOptions): UseTalkControllerResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(() =>
    voiceService.isSupported()
  );

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const { client: openAiClient, clientError } = useMemo(() => {
    if (!apiKey) {
      return { client: null, clientError: null } as const;
    }

    try {
      return { client: new OpenAIClient(apiKey), clientError: null } as const;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to initialise OpenAI client.";

      return { client: null, clientError: message } as const;
    }
  }, [apiKey]);

  useEffect(() => {
    if (clientError) {
      setErrorMessage(clientError);
    }
  }, [clientError]);

  useEffect(() => {
    setIsSupported(voiceService.isSupported());

    return () => {
      voiceService.stopSpeaking();
      void voiceService.cancelRecording();
      voiceService.dispose();
    };
  }, []);

  const processVoiceInput = useCallback(
    async (recording: VoiceRecording) => {
      try {
        if (!openAiClient) {
          setTranscript(DEMO_TRANSCRIPT);
          setResponse(DEMO_RESPONSE);
          await voiceService.speak(DEMO_RESPONSE);
          return;
        }

        const formData = new FormData();

        if (recording.kind === "web") {
          formData.append("file", recording.blob, "voice-input.webm");
        } else {
          formData.append("file", {
            uri: recording.uri,
            type: recording.mimeType,
            name: "voice-input.m4a",
          } as unknown as Blob);
        }

        formData.append("model", "whisper-1");

        const { text } = await openAiClient.createTranscription(formData);
        const userText = text || "Could not transcribe audio";
        setTranscript(userText);

        let aiResponse: string;

        if (customProcessor) {
          aiResponse = await customProcessor(userText);
        } else {
          const messages: ChatCompletionMessage[] = [
            {
              role: "system",
              content:
                "You are a helpful voice assistant. Keep responses conversational and concise.",
            },
            {
              role: "user",
              content: userText,
            },
          ];

          const chatResult = await openAiClient.createChatCompletion({
            model: "gpt-4o",
            messages,
            maxTokens: 150,
          });

          aiResponse =
            chatResult.content || "Sorry, I could not process your request.";
        }

        setResponse(aiResponse);
        await voiceService.speak(aiResponse, { apiKey });
      } catch {
        setResponse("Sorry, I could not process your voice input.");
      } finally {
        setIsProcessing(false);
      }
    },
    [apiKey, customProcessor, openAiClient]
  );

  const startRecording = useCallback(async () => {
    setErrorMessage(null);

    try {
      setTranscript("");
      setResponse("");
      await voiceService.startRecording();
      setIsRecording(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to start recording. Please check microphone permissions.";

      setErrorMessage(message);
      setIsRecording(false);
      setIsSupported(voiceService.isSupported());
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!isRecording) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const recording = await voiceService.stopRecording();
      setIsRecording(false);
      await processVoiceInput(recording);
    } catch (error) {
      setIsRecording(false);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to stop recording. Please try again.";

      setErrorMessage(message);
      setIsProcessing(false);
    }
  }, [isRecording, processVoiceInput]);

  const handlePress = useCallback(async () => {
    if (!isSupported) {
      setErrorMessage("Audio capture is not supported on this platform.");
      return;
    }

    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, isSupported, startRecording, stopRecording]);

  return {
    isSupported,
    isRecording,
    isProcessing,
    transcript,
    response,
    errorMessage,
    startRecording,
    stopRecording,
    handlePress,
    clearError,
  };
}

export default useTalkController;
