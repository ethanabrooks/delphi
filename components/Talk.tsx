import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";
import { Text, View } from "tamagui";
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
  const [_transcript, setTranscript] = useState("");
  const [_response, setResponse] = useState("");
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

  const toggleRecording = async () => {
    if (!isSupported) {
      Alert.alert(
        "Not Supported",
        "Audio capture is not supported on this platform."
      );
      return;
    }

    if (isRecording) {
      console.log("Stopping recording...");
      await stopRecording();
    } else if (!isProcessing) {
      // Stop any ongoing speech before starting to record
      voiceService.stopSpeaking();
      console.log("Starting recording...");
      await startRecording();
    }
  };

  const _clearConversation = () => {
    conversationAgent.clearConversation();
    setConversationId(undefined);
    setTranscript("");
    setResponse("");
  };

  return (
    <View style={styles.container}>
      {/* Discrete hamburger menu */}
      <Link href="/todo" style={styles.hamburger}>
        <Text style={styles.hamburgerText}>☰</Text>
      </Link>

      {/* Click anywhere to toggle recording */}
      <Pressable style={styles.recordArea} onPress={toggleRecording}>
        {/* Recording indicator */}
        {(isRecording || isProcessing) && (
          <View style={styles.indicator}>
            <Text style={styles.indicatorText}>
              {isRecording ? "🔴 Recording..." : "Processing..."}
            </Text>
          </View>
        )}

        {/* Dialogue text display */}
        {(_transcript || _response) && (
          <View style={styles.dialogueContainer}>
            {_transcript && (
              <View style={styles.userMessage}>
                <Text style={styles.userLabel}>You:</Text>
                <Text style={styles.userText}>{_transcript}</Text>
              </View>
            )}
            {_response && (
              <View style={styles.assistantMessage}>
                <Text style={styles.assistantLabel}>Assistant:</Text>
                <Text style={styles.assistantText}>{_response}</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  hamburger: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  hamburgerText: {
    fontSize: 24,
    color: "#666666",
  },
  recordArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  indicator: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  indicatorText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
  },
  dialogueContainer: {
    position: "absolute",
    bottom: 60,
    left: 20,
    right: 20,
    maxHeight: "40%",
  },
  userMessage: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  userLabel: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  userText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
  },
  assistantMessage: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: 12,
    borderRadius: 8,
  },
  assistantLabel: {
    color: "#aaaaaa",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  assistantText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
  },
});
