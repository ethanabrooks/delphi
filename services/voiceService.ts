import {
  Audio as ExpoAudio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from "expo-av";
import * as Speech from "expo-speech";
import { Platform } from "react-native";

type NativeRecording = {
  kind: "native";
  uri: string;
  durationMillis?: number;
  mimeType: string;
};

type WebRecording = {
  kind: "web";
  blob: Blob;
  mimeType: string;
};

export type VoiceRecording = NativeRecording | WebRecording;

interface VoiceService {
  isSupported(): boolean;
  startRecording(): Promise<void>;
  stopRecording(): Promise<VoiceRecording>;
  cancelRecording(): Promise<void>;
  speak(text: string, options?: { apiKey?: string }): Promise<void>;
}

class NativeVoiceService implements VoiceService {
  private recording: ExpoAudio.Recording | null = null;

  isSupported() {
    return true;
  }

  async startRecording() {
    const permission = await ExpoAudio.requestPermissionsAsync();

    if (permission.status !== "granted") {
      throw new Error("Microphone permission was denied");
    }

    await ExpoAudio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });

    const recording = new ExpoAudio.Recording();
    await recording.prepareToRecordAsync(
      ExpoAudio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await recording.startAsync();
    this.recording = recording;
  }

  async stopRecording(): Promise<VoiceRecording> {
    if (!this.recording) {
      throw new Error("No active recording");
    }

    const recording = this.recording;

    try {
      await recording.stopAndUnloadAsync();
    } finally {
      this.recording = null;
    }

    const status = await recording.getStatusAsync();
    const uri = recording.getURI();

    if (!uri) {
      throw new Error("Unable to retrieve the recorded audio file");
    }

    return {
      kind: "native",
      uri,
      mimeType: "audio/m4a",
      durationMillis:
        "durationMillis" in status ? status.durationMillis : undefined,
    };
  }

  async cancelRecording() {
    if (!this.recording) {
      return;
    }

    try {
      await this.recording.stopAndUnloadAsync();
    } catch {
      // Ignore cancellation errors
    } finally {
      this.recording = null;
    }
  }

  async speak(text: string) {
    if (!text) {
      return;
    }

    return new Promise<void>((resolve) => {
      Speech.stop();
      Speech.speak(text, {
        rate: 1.0,
        onDone: () => {
          resolve();
        },
        onStopped: () => {
          resolve();
        },
        onError: () => {
          resolve();
        },
      });
    });
  }
}

class WebVoiceService implements VoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  isSupported() {
    if (typeof navigator === "undefined") {
      return false;
    }

    return Boolean(navigator.mediaDevices?.getUserMedia);
  }

  async startRecording() {
    if (!this.isSupported()) {
      throw new Error("Web Audio API is not supported in this browser");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    this.audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    mediaRecorder.onerror = () => {
      this.cleanup();
    };

    mediaRecorder.start();
    this.mediaRecorder = mediaRecorder;
    this.stream = stream;
  }

  stopRecording(): Promise<VoiceRecording> {
    if (!this.mediaRecorder) {
      return Promise.reject(new Error("No active recording"));
    }

    return new Promise((resolve, reject) => {
      const recorder = this.mediaRecorder;

      if (!recorder) {
        reject(new Error("No active recording"));
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();
        resolve({
          kind: "web",
          blob,
          mimeType,
        });
      };

      recorder.onerror = (event) => {
        this.cleanup();
        reject(event.error || new Error("Recording failed"));
      };

      recorder.stop();
    });
  }

  async cancelRecording() {
    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.stop();
      } catch {
        // No-op
      }
    }

    this.cleanup();
  }

  async speak(text: string, options?: { apiKey?: string }) {
    if (!text) {
      return;
    }

    const speakWithWebSpeech = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    };

    if (!options?.apiKey) {
      speakWithWebSpeech();
      return;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: "alloy",
          speed: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS request failed with status ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new window.Audio(url);

      await audio.play();

      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(url);
      });
    } catch {
      speakWithWebSpeech();
    }
  }

  private cleanup() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
  }
}

const voiceService: VoiceService =
  Platform.OS === "web" ? new WebVoiceService() : new NativeVoiceService();

export default voiceService;
