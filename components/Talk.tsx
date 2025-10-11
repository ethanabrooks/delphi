import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert, Platform } from "react-native";

interface TalkProps {
  apiKey?: string;
  customProcessor?: (transcript: string) => Promise<string>;
}

export default function Talk({
  apiKey,
  customProcessor,
}: TalkProps) {
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
        // Web Audio API not supported
      }
    }
  };

  const startRecording = async () => {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Platform not supported",
        "This component is designed for web use",
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
            "I heard you say: Hello! This is a web demo recording. How can I help you today?",
          );

          // Use Web Speech API for TTS if available
          if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(
              "I heard you say: Hello! This is a web demo recording. How can I help you today?",
            );
            speechSynthesis.speak(utterance);
          }
        }

        setIsProcessing(false);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch {
      // Failed to start recording
      setIsRecording(false);
      Alert.alert(
        "Recording Error",
        "Failed to access microphone. Please ensure microphone permissions are granted.",
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
          // Convert audio blob to FormData for API upload

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
            },
          );

          if (!transcriptionResponse.ok) {
            throw new Error(
              `Transcription failed: ${transcriptionResponse.status}`,
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
              },
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
          // Failed to process voice input
          setResponse("Sorry, I encountered an error processing your request.");
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch {
      // Failed to process voice input
      setResponse("Sorry, I could not process your voice input.");
    }
  };

  const handlePress = () => {
    if (!isSupported) {
      Alert.alert(
        "Not Supported",
        "Web Audio API is not supported in this browser",
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
    <View className="flex-1 justify-center items-center p-6 space-y-6">
      <Text className="text-3xl font-bold text-gray-800 mb-4">
        Voice Assistant
      </Text>

      {!isSupported && (
        <View className="bg-yellow-100 p-4 rounded-lg mb-4">
          <Text className="text-yellow-800 text-center">
            Web Audio not supported in this browser. Please use Chrome, Firefox,
            or Safari.
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handlePress}
        disabled={isProcessing || !isSupported}
        className={`w-32 h-32 rounded-full items-center justify-center ${
          !isSupported
            ? "bg-gray-300"
            : isRecording
              ? "bg-red-500"
              : isProcessing
                ? "bg-yellow-500"
                : "bg-blue-500"
        }`}
      >
        <Text
          className={`text-lg font-semibold ${!isSupported ? "text-gray-500" : "text-white"}`}
        >
          {!isSupported
            ? "Not Supported"
            : isProcessing
              ? "Processing..."
              : isRecording
                ? "Stop"
                : "Talk"}
        </Text>
      </TouchableOpacity>

      {transcript && (
        <View className="bg-gray-100 p-4 rounded-lg max-w-sm">
          <Text className="text-sm text-gray-600 mb-1">You said:</Text>
          <Text className="text-gray-800">{transcript}</Text>
        </View>
      )}

      {response && (
        <View className="bg-blue-100 p-4 rounded-lg max-w-sm">
          <Text className="text-sm text-blue-600 mb-1">Assistant:</Text>
          <Text className="text-blue-800">{response}</Text>
        </View>
      )}

      {!apiKey ? (
        <Text className="text-xs text-gray-500 text-center max-w-sm">
          Demo mode: Add your OpenAI API key for full functionality
        </Text>
      ) : (
        <Text className="text-xs text-gray-600 text-center max-w-sm">
          Using OpenAI Whisper + GPT-4o + Web Speech API
        </Text>
      )}
    </View>
  );
}