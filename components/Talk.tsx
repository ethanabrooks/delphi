import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    checkWebAudioSupport();
  }, []);

  const checkWebAudioSupport = () => {
    if (Platform.OS === "web") {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsSupported(false);
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
        stream.getTracks().forEach((track) => track.stop());

        if (apiKey) {
          await processVoiceInput(audioBlob);
        } else {
          // Demo mode
          setTranscript("Hello! This is a web demo recording.");
          setResponse(
            "I heard you say: Hello! This is a web demo recording. How can I help you today?"
          );

          // Use Web Speech API for TTS if available
          if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(
              "I heard you say: Hello! This is a web demo recording. How can I help you today?"
            );
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

          // Convert AI response to speech using Web Speech API
          if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(aiResponse);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            speechSynthesis.speak(utterance);
          }
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
          Using OpenAI Whisper + GPT-4o + Web Speech API
        </Text>
      )}
    </YStack>
  );
}
