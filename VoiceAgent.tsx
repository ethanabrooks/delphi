import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

interface VoiceAgentProps {
  apiKey?: string;
}

export default function VoiceAgent({ apiKey }: VoiceAgentProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    setupAudio();
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  const setupAudio = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Microphone access is required for voice features');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Failed to setup audio:', error);
    }
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      setTranscript('');
      setResponse('');

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 24000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 24000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;

      setIsRecording(false);
      setIsProcessing(true);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri && apiKey) {
        await processVoiceInput(uri);
      } else if (!apiKey) {
        // Demo mode without API key
        setTranscript('Hello! This is a demo recording.');
        setResponse('I heard you say: Hello! This is a demo recording. How can I help you today?');
        Speech.speak('I heard you say: Hello! This is a demo recording. How can I help you today?');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const processVoiceInput = async (audioUri: string) => {
    try {
      if (!apiKey) {
        throw new Error('OpenAI API key not provided');
      }

      // Convert audio to base64 for OpenAI API
      const response = await fetch(audioUri);
      const audioBlob = await response.blob();
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];

          // Use OpenAI Speech-to-Text API
          const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'whisper-1',
              audio: base64Audio,
              response_format: 'json'
            }),
          });

          const transcriptionData = await transcriptionResponse.json();
          const userText = transcriptionData.text || 'Could not transcribe audio';
          setTranscript(userText);

          // Get AI response using OpenAI Chat API
          const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-realtime-preview',
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful voice assistant. Keep responses conversational and concise.'
                },
                {
                  role: 'user',
                  content: userText
                }
              ],
              max_tokens: 150
            }),
          });

          const chatData = await chatResponse.json();
          const aiResponse = chatData.choices?.[0]?.message?.content || 'Sorry, I could not process your request.';
          setResponse(aiResponse);

          // Convert AI response to speech
          Speech.speak(aiResponse, {
            voice: 'com.apple.ttsbundle.Samantha-compact'
          });

        } catch (error) {
          console.error('Failed to process voice input:', error);
          setResponse('Sorry, I encountered an error processing your request.');
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Failed to process voice input:', error);
      setResponse('Sorry, I could not process your voice input.');
    }
  };

  const handlePress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <View className="flex-1 justify-center items-center p-6 space-y-6">
      <Text className="text-3xl font-bold text-gray-800 mb-4">Voice Assistant</Text>

      <TouchableOpacity
        onPress={handlePress}
        disabled={isProcessing}
        className={`w-32 h-32 rounded-full items-center justify-center ${
          isRecording
            ? 'bg-red-500'
            : isProcessing
              ? 'bg-gray-400'
              : 'bg-blue-500'
        }`}
      >
        <Text className="text-white text-lg font-semibold">
          {isProcessing ? 'Processing...' : isRecording ? 'Stop' : 'Talk'}
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

      {!apiKey && (
        <Text className="text-xs text-gray-500 text-center max-w-sm">
          Demo mode: Add your OpenAI API key for full functionality
        </Text>
      )}
    </View>
  );
}