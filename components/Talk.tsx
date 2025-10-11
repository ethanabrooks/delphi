import { useEffect } from "react";
import { Alert } from "react-native";
import { Button, Text, YStack } from "tamagui";
import useTalkController from "../hooks/useTalkController";

interface TalkProps {
  apiKey?: string;
  customProcessor?: (transcript: string) => Promise<string>;
}

export default function Talk({ apiKey, customProcessor }: TalkProps) {
  const {
    isSupported,
    isRecording,
    isProcessing,
    transcript,
    response,
    handlePress,
    errorMessage,
    clearError,
  } = useTalkController({ apiKey, customProcessor });

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    Alert.alert("Recording Error", errorMessage, [
      { text: "OK", onPress: clearError },
    ]);
  }, [clearError, errorMessage]);

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
          Using OpenAI Whisper + GPT-4o with platform-native speech playback
        </Text>
      )}
    </YStack>
  );
}
