import { Link } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View } from "tamagui";
import { useConversationAgent } from "../hooks/useConversationAgent";
import OpenAIClient from "../services/openaiClient";
import voiceService, { type VoiceRecording } from "../services/voiceService";
import SoundWaveAnimation from "./SoundWaveAnimation";

interface TalkProps {
  apiKey?: string;
  customProcessor?: (transcript: string) => Promise<string>;
}

export default function Talk({ apiKey, customProcessor }: TalkProps) {
  const insets = useSafeAreaInsets();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [_transcript, setTranscript] = useState("");
  const [_response, setResponse] = useState("");
  const [isSupported, setIsSupported] = useState(() =>
    voiceService.isSupported()
  );
  const [amplitudeData, setAmplitudeData] = useState<number[]>([]);
  const [textInput, setTextInput] = useState("");

  // Create video player (iOS will use it, web won't)
  const videoPlayer = useVideoPlayer(
    require("../assets/videos/background-video.mp4"),
    (player) => {
      player.loop = true;
      player.muted = true;
      player.play();
    }
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

  const { agent: conversationAgent } = useConversationAgent({ apiKey });

  useEffect(() => {
    setIsSupported(voiceService.isSupported());

    // Set up amplitude data callback for voice-responsive animation
    if (voiceService.onAmplitudeData) {
      voiceService.onAmplitudeData(setAmplitudeData);
    }

    return () => {
      voiceService.stopSpeaking();
      void voiceService.cancelRecording();
      voiceService.dispose();
    };
  }, []);

  const startRecording = async () => {
    try {
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
      }

      setResponse(aiResponse);
      await voiceService.speak(aiResponse, { apiKey });
    } catch {
      setResponse("Sorry, I could not process your voice input.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePressIn = async () => {
    if (!isSupported) {
      Alert.alert(
        "Not Supported",
        "Audio capture is not supported on this platform."
      );
      return;
    }

    if (isRecording || isProcessing) {
      return;
    }

    // Stop any ongoing speech before starting to record
    voiceService.stopSpeaking();
    await startRecording();
  };

  const handlePressOut = async () => {
    if (isRecording) {
      await stopRecording();
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim() || isProcessing) {
      return;
    }

    const userText = textInput.trim();
    setTextInput("");
    setTranscript(userText);
    setIsProcessing(true);

    try {
      // Stop any ongoing speech before processing new text
      voiceService.stopSpeaking();

      let aiResponse: string;

      if (customProcessor) {
        aiResponse = await customProcessor(userText);
      } else {
        aiResponse = await conversationAgent.processMessage(userText);
      }

      setResponse(aiResponse);
      await voiceService.speak(aiResponse, { apiKey });
    } catch {
      setResponse("Sorry, I could not process your text input.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background video - iOS */}
      {Platform.OS === "ios" && videoPlayer && (
        <VideoView
          style={styles.backgroundVideo}
          player={videoPlayer}
          nativeControls={false}
          contentFit="cover"
        />
      )}

      {/* Background video - Web */}
      {Platform.OS === "web" && (
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            top: -50,
            left: 0,
            bottom: 0,
            right: 0,
            width: "100%",
            height: "110%",
            objectFit: "cover",
          }}
        >
          <source
            src={require("../assets/videos/background-video.mp4")}
            type="video/mp4"
          />
        </video>
      )}

      <View style={styles.overlay} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Math.max(insets.top, 24)}
      >
        <View
          style={[
            styles.safeArea,
            {
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom, 28),
            },
          ]}
        >
          <View style={styles.header}>
            <Link href="/todo" style={styles.hamburger}>
              <Text style={styles.hamburgerText}>☰</Text>
            </Link>
          </View>

          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={({ pressed }) => [
              styles.voiceButton,
              (isRecording || isProcessing) && styles.voiceButtonActive,
              pressed &&
                !(isRecording || isProcessing) &&
                styles.voiceButtonPressed,
            ]}
          >
            <View style={styles.voiceContent}>
              {isRecording ? (
                <View style={styles.waveWrapper}>
                  <SoundWaveAnimation
                    isActive={true}
                    amplitudeData={amplitudeData}
                    color="#38bdf8"
                  />
                  <Text style={styles.voiceStatus}>Listening...</Text>
                </View>
              ) : isProcessing ? (
                <Text style={styles.voiceStatus}>Processing...</Text>
              ) : (
                <>
                  <Text style={styles.voiceTitle}>Hold to Talk</Text>
                  <Text style={styles.voiceSubtitle}>
                    Press and speak to share what you need
                  </Text>
                </>
              )}
            </View>
          </Pressable>

          <View style={styles.dialogueWrapper}>
            {_transcript || _response ? (
              <View style={styles.messagesContainer}>
                {_transcript && (
                  <View
                    style={[
                      styles.messageBubble,
                      styles.userMessage,
                      Platform.OS === "web" && styles.messageBubbleWeb,
                    ]}
                  >
                    <Text style={styles.messageLabel}>You</Text>
                    <Text style={styles.messageText}>{_transcript}</Text>
                  </View>
                )}
                {_response && (
                  <View
                    style={[
                      styles.messageBubble,
                      styles.assistantMessage,
                      Platform.OS === "web" && styles.messageBubbleWeb,
                    ]}
                  >
                    <Text style={styles.messageLabel}>Assistant</Text>
                    <Text style={styles.messageText}>{_response}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.placeholderText}>
                Your conversation will appear here.
              </Text>
            )}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.textInput,
                Platform.OS === "web" && styles.textInputWeb,
              ]}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Type a message..."
              placeholderTextColor="rgba(203,213,225,0.45)"
              editable={!isProcessing}
              onSubmitEditing={handleTextSubmit}
              returnKeyType="send"
              multiline={false}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                Platform.OS === "web" && styles.sendButtonWeb,
                (!textInput.trim() || isProcessing) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={handleTextSubmit}
              disabled={!textInput.trim() || isProcessing}
            >
              <Text style={styles.sendButtonText}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#000000" : "transparent",
  },
  flex: {
    flex: 1,
  },
  backgroundVideo: {
    position: "absolute",
    top: -50,
    left: 0,
    bottom: 0,
    right: 0,
    width: "100%",
    height: "110%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  header: {
    width: "100%",
    alignItems: "flex-end",
    marginBottom: 32,
  },
  hamburger: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  hamburgerText: {
    fontSize: 20,
    color: "rgba(248, 250, 252, 0.85)",
  },
  voiceButton: {
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  voiceButtonPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
  },
  voiceButtonActive: {
    backgroundColor: "rgba(8, 47, 73, 0.65)",
    borderColor: "rgba(56, 189, 248, 0.6)",
  },
  voiceContent: {
    alignItems: "center",
  },
  waveWrapper: {
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  voiceTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8fafc",
  },
  voiceSubtitle: {
    fontSize: 14,
    color: "rgba(226, 232, 240, 0.75)",
    marginTop: 6,
    textAlign: "center",
  },
  voiceStatus: {
    fontSize: 16,
    fontWeight: "500",
    color: "#e0f2fe",
    textAlign: "center",
  },
  dialogueWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    marginTop: 36,
  },
  messagesContainer: {
    width: "100%",
  },
  messageBubble: {
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 18,
    paddingRight: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    maxWidth: "88%",
    flexShrink: 1,
  },
  messageBubbleWeb: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 24,
    paddingRight: 24,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(248, 250, 252, 0.08)",
    borderColor: "rgba(248, 250, 252, 0.12)",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderColor: "rgba(148, 163, 184, 0.18)",
    marginBottom: 0,
  },
  messageLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(226, 232, 240, 0.7)",
    marginBottom: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#f1f5f9",
  },
  placeholderText: {
    fontSize: 14,
    color: "rgba(226, 232, 240, 0.55)",
    textAlign: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginTop: 28,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 16,
    paddingVertical: 10,
    paddingRight: 12,
  },
  textInputWeb: {
    outlineWidth: 0,
    outlineStyle: "none",
  } as const as any,
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#38bdf8",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(148, 163, 184, 0.25)",
  },
  sendButtonWeb: {
    outlineWidth: 0,
    outlineStyle: "none",
    marginVertical: 8,
  } as const as any,
  sendButtonText: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700",
  },
});
