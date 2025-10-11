import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { Button, Text, YStack } from "tamagui";

interface TalkProps {
  apiKey?: string;
  customProcessor?: (transcript: string) => Promise<string>;
}

export default function Talk({ apiKey, customProcessor }: TalkProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const checkWebAudioSupport = useCallback(() => {
    if (Platform.OS === "web") {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsSupported(false);
      }
    }
  }, []);

  useEffect(() => {
    checkWebAudioSupport();
  }, [checkWebAudioSupport]);

  const convertTextToSpeech = async (text: string, apiKey: string) => {
    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: "alloy",
          speed: 1.0, // Keep at 1.0 to avoid robotic sound
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API failed: ${response.status}`);
      }

      const audioData = await response.arrayBuffer();
      const audioBlob = new Blob([audioData], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      await audio.play();

      // Clean up the blob URL after playing
      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(audioUrl);
      });
    } catch (_error) {
      // Silent fallback to Web Speech API if OpenAI TTS fails
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0; // Keep at default speed for better quality
        speechSynthesis.speak(utterance);
      }
    }
  };

  const startRecording = async () => {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Platform not supported",
        "This component is designed for web use"
      );
      return;
    }

    try {
      setIsRecording(true);
      setTranscript("");
      setResponse("");
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });

        // Stop all audio tracks
        for (const track of stream.getTracks()) {
          track.stop();
        }

        if (apiKey) {
          await processVoiceInput(audioBlob);
        } else {
          // Demo mode
          setTranscript("Hello! This is a web demo recording.");
          setResponse(
            "I heard you say: Hello! This is a web demo recording. How can I help you today?"
          );

          // Use Web Speech API for TTS in demo mode (fallback)
          if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(
              "I heard you say: Hello! This is a web demo recording. How can I help you today?"
            );
            utterance.rate = 1.0; // Keep at default speed for better quality
            speechSynthesis.speak(utterance);
          }
        }

        setIsProcessing(false);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch {
      setIsRecording(false);
      Alert.alert(
        "Recording Error",
        "Failed to access microphone. Please ensure microphone permissions are granted."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      setIsProcessing(true);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    try {
      if (!apiKey) {
        throw new Error("OpenAI API key not provided");
      }

      // Convert blob to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          // Use OpenAI Speech-to-Text API
          const formData = new FormData();
          formData.append("file", audioBlob, "audio.wav");
          formData.append("model", "whisper-1");

          const transcriptionResponse = await fetch(
            "https://api.openai.com/v1/audio/transcriptions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
              body: formData,
            }
          );

          if (!transcriptionResponse.ok) {
            throw new Error(
              `Transcription failed: ${transcriptionResponse.status}`
            );
          }

          const transcriptionData = await transcriptionResponse.json();
          const userText =
            transcriptionData.text || "Could not transcribe audio";
          setTranscript(userText);

          // Use custom processor if available, otherwise use OpenAI Chat API
          let aiResponse: string;

          if (customProcessor) {
            aiResponse = await customProcessor(userText);
          } else {
            // Get AI response using OpenAI Chat API
            const chatResponse = await fetch(
              "https://api.openai.com/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "gpt-4o",
                  messages: [
                    {
                      role: "system",
                      content:
                        "You are a helpful voice assistant. Keep responses conversational and concise.",
                    },
                    {
                      role: "user",
                      content: userText,
                    },
                  ],
                  max_tokens: 150,
                }),
              }
            );

            if (!chatResponse.ok) {
              throw new Error(`Chat API failed: ${chatResponse.status}`);
            }

            const chatData = await chatResponse.json();
            aiResponse =
              chatData.choices?.[0]?.message?.content ||
              "Sorry, I could not process your request.";
          }

          setResponse(aiResponse);

          // Convert AI response to speech using OpenAI TTS API
          await convertTextToSpeech(aiResponse, apiKey);
        } catch {
          setResponse("Sorry, I encountered an error processing your request.");
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch {
      setResponse("Sorry, I could not process your voice input.");
    }
  };

  const handlePress = () => {
    if (!isSupported) {
      Alert.alert(
        "Not Supported",
        "Web Audio API is not supported in this browser"
      );
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
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
            Web Audio not supported in this browser. Please use Chrome, Firefox,
            or Safari.
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
          Using OpenAI Whisper + GPT-4o + TTS-1 (High Quality Voice)
        </Text>
      )}
    </YStack>
  );
}
