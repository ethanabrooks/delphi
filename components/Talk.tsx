import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { Button, Text, YStack } from "tamagui";
import { ConversationAgent } from "../services/conversationAgent";
import OpenAIClient from "../services/openaiClient";
import voiceService, { type VoiceRecording } from "../services/voiceService";

interface TalkProps {
  apiKey?: string;
  customProcessor?: (transcript: string) => Promise<string>;
}

export default function Talk({ apiKey, customProcessor }: TalkProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isSupported, setIsSupported] = useState(() =>
    voiceService.isSupported()
  );

  const openAiClient = useMemo(() => {
    if (!apiKey) {
      return null;
    }

    try {
      return new OpenAIClient(apiKey);
    } catch {
      return null;
    }
  }, [apiKey]);

  const conversationAgent = useMemo(() => {
    return new ConversationAgent(apiKey);
  }, [apiKey]);

  useEffect(() => {
    setIsSupported(voiceService.isSupported());

    return () => {
      void voiceService.cancelRecording();
    };
  }, []);

  const startRecording = async () => {
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

      Alert.alert("Recording Error", message);
      setIsRecording(false);
      setIsSupported(voiceService.isSupported());
    }
  };

  const stopRecording = async () => {
    if (!isRecording) {
      return;
    }

    setIsProcessing(true);

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

      Alert.alert("Recording Error", message);
      setIsProcessing(false);
    }
  };

  const processVoiceInput = async (recording: VoiceRecording) => {
    try {
      if (!openAiClient) {
        const demoTranscript = "Hello! This is a demo recording.";
        const demoResponse =
          "I heard you say: Hello! This is a demo recording. How can I help you manage your todos today?";

        setTranscript(demoTranscript);
        setResponse(demoResponse);
        await voiceService.speak(demoResponse);
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

      const { text: transcriptionText } =
        await openAiClient.createTranscription(formData);
      const userText = transcriptionText || "Could not transcribe audio";
      setTranscript(userText);

      let aiResponse: string;

      if (customProcessor) {
        aiResponse = await customProcessor(userText);
      } else {
        aiResponse = await conversationAgent.processMessage(userText);

        // Update conversation ID for state tracking
        const newConversationId = conversationAgent.getConversationId();
        if (newConversationId && newConversationId !== conversationId) {
          setConversationId(newConversationId);
        }
      }

      setResponse(aiResponse);
      await voiceService.speak(aiResponse, { apiKey });
    } catch {
      setResponse("Sorry, I could not process your voice input.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePress = async () => {
    if (!isSupported) {
      Alert.alert(
        "Not Supported",
        "Audio capture is not supported on this platform."
      );
      return;
    }

    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const clearConversation = () => {
    conversationAgent.clearConversation();
    setConversationId(undefined);
    setTranscript("");
    setResponse("");
  };

  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      padding="$6"
      gap="$6"
    >
      <Text fontSize="$10" fontWeight="bold" color="$gray12" marginBottom="$4">
        Voice Assistant
      </Text>

      {!isSupported && (
        <YStack
          backgroundColor="$yellow3"
          padding="$4"
          borderRadius="$4"
          marginBottom="$4"
        >
          <Text color="$yellow11" textAlign="center">
            Audio capture is unavailable. Please switch to a compatible device
            or browser.
          </Text>
        </YStack>
      )}

      <Button
        onPress={handlePress}
        disabled={isProcessing || !isSupported}
        width={128}
        height={128}
        borderRadius={64}
        backgroundColor={
          !isSupported
            ? "$gray6"
            : isRecording
              ? "$red9"
              : isProcessing
                ? "$yellow9"
                : "$blue9"
        }
        justifyContent="center"
        alignItems="center"
      >
        <Text
          fontSize="$5"
          fontWeight="600"
          color={!isSupported ? "$gray10" : "white"}
        >
          {!isSupported
            ? "Not Supported"
            : isProcessing
              ? "Processing..."
              : isRecording
                ? "Stop"
                : "Talk"}
        </Text>
      </Button>

      {conversationId && (
        <Button
          onPress={clearConversation}
          size="$3"
          backgroundColor="$gray8"
          color="white"
          marginTop="$3"
        >
          Clear Conversation
        </Button>
      )}

      {transcript && (
        <YStack
          backgroundColor="$gray3"
          padding="$4"
          borderRadius="$4"
          maxWidth={320}
        >
          <Text fontSize="$3" color="$gray10" marginBottom="$1">
            You said:
          </Text>
          <Text color="$gray12">{transcript}</Text>
        </YStack>
      )}

      {response && (
        <YStack
          backgroundColor="$blue3"
          padding="$4"
          borderRadius="$4"
          maxWidth={320}
        >
          <Text fontSize="$3" color="$blue10" marginBottom="$1">
            Assistant:
          </Text>
          <Text color="$blue12">{response}</Text>
        </YStack>
      )}

      {!apiKey ? (
        <Text fontSize="$2" color="$gray9" textAlign="center" maxWidth={320}>
          Demo mode: Add your OpenAI API key for full functionality
        </Text>
      ) : (
        <Text fontSize="$2" color="$gray10" textAlign="center" maxWidth={320}>
          Using OpenAI Whisper + GPT-4o with advanced conversation management
        </Text>
      )}
    </YStack>
  );
}
