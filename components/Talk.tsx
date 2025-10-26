import { Link } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
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

      {/* Discrete hamburger menu */}
      <Link href="/todo" style={styles.hamburger}>
        <Text style={styles.hamburgerText}>☰</Text>
      </Link>

      {/* Press and hold to record */}
      <Pressable
        style={styles.recordArea}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Recording indicator */}
        {(isRecording || isProcessing) && (
          <View style={styles.indicator}>
            {isRecording ? (
              <SoundWaveAnimation
                isActive={true}
                amplitudeData={amplitudeData}
                color="#ffffff"
              />
            ) : (
              <Text style={styles.indicatorText}>Processing...</Text>
            )}
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

      {/* Text input area */}
      <View style={styles.textInputContainer}>
        <TextInput
          style={styles.textInput}
          value={textInput}
          onChangeText={setTextInput}
          placeholder="Type a message..."
          placeholderTextColor="#888888"
          editable={!isProcessing}
          onSubmitEditing={handleTextSubmit}
          returnKeyType="send"
          multiline={false}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!textInput.trim() || isProcessing) && styles.sendButtonDisabled,
          ]}
          onPress={handleTextSubmit}
          disabled={!textInput.trim() || isProcessing}
        >
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#000000" : "transparent",
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
  hamburger: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  hamburgerText: {
    fontSize: 24,
    color: "#ffffff",
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
    bottom: 80,
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
  textInputContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  textInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    color: "#ffffff",
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  sendButtonDisabled: {
    opacity: 0.4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  sendButtonText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "600",
  },
});
