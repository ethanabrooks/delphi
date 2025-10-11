import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';

// Dynamic import for expo-av to handle web compatibility
let Audio: any = null;
if (Platform.OS !== 'web') {
  try {
    Audio = require('expo-av').Audio;
  } catch (error) {
    console.warn('expo-av not available:', error);
  }
}

interface RealtimeVoiceAgentProps {
  apiKey?: string;
}

export default function RealtimeVoiceAgent({ apiKey }: RealtimeVoiceAgentProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (apiKey) {
      connectToRealtime();
    }
    return () => {
      disconnect();
    };
  }, [apiKey]);

  const connectToRealtime = () => {
    if (!apiKey) {
      setStatus('No API key provided');
      return;
    }

    try {
      const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01');

      ws.onopen = () => {
        setIsConnected(true);
        setStatus('Connected');

        // Send session configuration
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'You are a helpful voice assistant. Keep responses conversational and engaging.',
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            }
          }
        }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleRealtimeMessage(message);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setStatus('Disconnected');
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('Connection error');
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect to Realtime API:', error);
      setStatus('Connection failed');
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }
    setIsConnected(false);
    setIsRecording(false);
    setIsPlaying(false);
  };

  const handleRealtimeMessage = (message: any) => {
    switch (message.type) {
      case 'session.created':
        setStatus('Session ready');
        break;

      case 'input_audio_buffer.speech_started':
        setStatus('Listening...');
        break;

      case 'input_audio_buffer.speech_stopped':
        setStatus('Processing...');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        setStatus(`You said: "${message.transcript}"`);
        break;

      case 'response.audio.delta':
        // Handle streaming audio response
        if (message.delta) {
          playAudioChunk(message.delta);
        }
        break;

      case 'response.done':
        setStatus('Response complete');
        setIsPlaying(false);
        break;

      case 'error':
        console.error('Realtime API error:', message.error);
        setStatus(`Error: ${message.error.message}`);
        break;
    }
  };

  const playAudioChunk = async (base64Audio: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const binaryString = atob(base64Audio);
      const audioBuffer = new ArrayBuffer(binaryString.length);
      const uint8Array = new Uint8Array(audioBuffer);

      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      const decodedAudio = await audioContext.decodeAudioData(audioBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(audioContext.destination);
      source.start();

      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play audio chunk:', error);
    }
  };

  const startVoiceSession = async () => {
    if (!isConnected || !wsRef.current) {
      Alert.alert('Not Connected', 'Please wait for connection to be established');
      return;
    }

    try {
      // Request microphone permission
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Microphone access is required');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
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
      setIsRecording(true);
      setStatus('Recording... (tap to stop)');

      // Start sending audio data in real-time (simplified for demo)
      // In a production app, you'd want to stream audio chunks continuously

    } catch (error) {
      console.error('Failed to start voice session:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopVoiceSession = async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;

        if (uri && wsRef.current) {
          // Convert audio to base64 and send to Realtime API
          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Audio
          }));

          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.commit'
          }));

          wsRef.current.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text', 'audio'],
              instructions: 'Please respond naturally to what the user said.'
            }
          }));
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    } finally {
      setIsRecording(false);
    }
  };

  const toggleVoiceSession = () => {
    if (isRecording) {
      stopVoiceSession();
    } else {
      startVoiceSession();
    }
  };

  return (
    <View className="flex-1 justify-center items-center p-6">
      <Text className="text-3xl font-bold text-gray-800 mb-6">Realtime Voice Agent</Text>

      <View className="bg-white p-4 rounded-lg mb-6 min-w-xs">
        <Text className="text-sm text-gray-600 mb-1">Status:</Text>
        <Text className="text-gray-800 font-medium">{status}</Text>
      </View>

      <TouchableOpacity
        onPress={toggleVoiceSession}
        disabled={!isConnected || isPlaying}
        className={`w-32 h-32 rounded-full items-center justify-center ${
          !isConnected
            ? 'bg-gray-400'
            : isRecording
              ? 'bg-red-500'
              : isPlaying
                ? 'bg-green-500'
                : 'bg-blue-500'
        }`}
      >
        <Text className="text-white text-lg font-semibold text-center">
          {!isConnected
            ? 'Connecting...'
            : isRecording
              ? 'Stop'
              : isPlaying
                ? 'Playing'
                : 'Talk'
          }
        </Text>
      </TouchableOpacity>

      {!apiKey ? (
        <Text className="text-xs text-gray-500 text-center max-w-sm mt-6">
          Add your OpenAI API key to enable Realtime API functionality
        </Text>
      ) : !isConnected ? (
        <TouchableOpacity
          onPress={connectToRealtime}
          className="mt-4 bg-gray-500 px-4 py-2 rounded"
        >
          <Text className="text-white">Reconnect</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}