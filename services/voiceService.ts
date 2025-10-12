import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
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
  stopSpeaking(): void;
  onAmplitudeData?: (callback: (amplitudes: number[]) => void) => void;
  offAmplitudeData?: () => void;
}

class NativeVoiceService implements VoiceService {
  private recording: InstanceType<typeof AudioModule.AudioRecorder> | null =
    null;

  isSupported() {
    return true;
  }

  async startRecording() {
    const permission = await requestRecordingPermissionsAsync();

    if (permission.status !== "granted") {
      throw new Error("Microphone permission was denied");
    }

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      interruptionModeAndroid: "doNotMix",
      shouldRouteThroughEarpiece: false,
    });

    const recording = new AudioModule.AudioRecorder(
      RecordingPresets.HIGH_QUALITY
    );
    await recording.prepareToRecordAsync();
    recording.record();
    this.recording = recording;
  }

  async stopRecording(): Promise<VoiceRecording> {
    if (!this.recording) {
      throw new Error("No active recording");
    }

    const recording = this.recording;

    try {
      await recording.stop();
    } finally {
      this.recording = null;
    }

    const status = recording.getStatus();
    const uri = recording.uri;

    if (!uri) {
      throw new Error("Unable to retrieve the recorded audio file");
    }

    return {
      kind: "native",
      uri,
      mimeType: "audio/m4a",
      durationMillis: status.durationMillis,
    };
  }

  async cancelRecording() {
    if (!this.recording) {
      return;
    }

    try {
      await this.recording.stop();
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

  stopSpeaking(): void {
    Speech.stop();
  }
}

class WebVoiceService implements VoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private activeAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private amplitudeCallback: ((amplitudes: number[]) => void) | null = null;
  private animationFrameId: number | null = null;

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

    // Set up Web Audio API for real-time amplitude analysis
    this.setupAudioAnalysis(stream);
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

    // Stop any ongoing speech before starting new speech
    this.stopSpeaking();

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

      // Track the active audio element
      this.activeAudio = audio;

      await audio.play();

      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(url);
        if (this.activeAudio === audio) {
          this.activeAudio = null;
        }
      });

      audio.addEventListener("pause", () => {
        if (this.activeAudio === audio) {
          this.activeAudio = null;
        }
      });
    } catch {
      speakWithWebSpeech();
    }
  }

  stopSpeaking(): void {
    // Stop Web Speech API
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // Stop OpenAI TTS audio if active
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch {
        // Ignore errors during audio stopping
      }
      this.activeAudio = null;
    }
  }

  onAmplitudeData(callback: (amplitudes: number[]) => void) {
    this.amplitudeCallback = callback;
  }

  offAmplitudeData() {
    this.amplitudeCallback = null;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private setupAudioAnalysis(stream: MediaStream) {
    try {
      // Create audio context and analyser node
      this.audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      this.analyserNode = this.audioContext.createAnalyser();

      // Configure analyser for balanced responsiveness
      this.analyserNode.fftSize = 512; // Good resolution without being too aggressive
      this.analyserNode.smoothingTimeConstant = 0.2; // Some smoothing for natural movement
      this.analyserNode.minDecibels = -70; // Moderately sensitive
      this.analyserNode.maxDecibels = -20; // Reasonable dynamic range

      // Connect microphone stream to analyser
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyserNode);

      // Start amplitude monitoring
      this.startAmplitudeMonitoring();
    } catch (_error) {
      // Audio analysis setup failed - continue without real-time visualization
    }
  }

  private startAmplitudeMonitoring() {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateAmplitude = () => {
      if (!this.analyserNode || !this.amplitudeCallback) return;

      // Get frequency data for amplitude visualization
      this.analyserNode.getByteFrequencyData(dataArray);

      // Convert to 5 amplitude values for our 5 bars
      const amplitudes = this.processAmplitudeData(dataArray);

      this.amplitudeCallback(amplitudes);

      // Continue monitoring
      this.animationFrameId = requestAnimationFrame(updateAmplitude);
    };

    this.animationFrameId = requestAnimationFrame(updateAmplitude);
  }

  private processAmplitudeData(data: Uint8Array): number[] {
    const barCount = 5;
    const amplitudes: number[] = [];

    // Focus on voice frequency ranges (roughly 85Hz to 3.4kHz for human speech)
    // Distribute bars across overlapping frequency ranges for better visual effect
    const voiceRanges = [
      { start: 0, end: Math.floor(data.length * 0.12) }, // Low frequencies
      {
        start: Math.floor(data.length * 0.05),
        end: Math.floor(data.length * 0.2),
      }, // Low-mid overlap
      {
        start: Math.floor(data.length * 0.12),
        end: Math.floor(data.length * 0.32),
      }, // Mid frequencies
      {
        start: Math.floor(data.length * 0.2),
        end: Math.floor(data.length * 0.45),
      }, // Mid-high overlap
      {
        start: Math.floor(data.length * 0.28),
        end: Math.floor(data.length * 0.5),
      }, // Upper voice range
    ];

    for (let i = 0; i < barCount; i++) {
      const range = voiceRanges[i];
      let peak = 0;

      // Find peak value in this frequency range
      for (let j = range.start; j < range.end; j++) {
        peak = Math.max(peak, data[j] || 0);
      }

      let normalized = peak / 255;

      // Apply scaling for better visual response
      normalized = Math.min(normalized * 6, 1);

      // Apply square root for natural response curve
      normalized = Math.sqrt(normalized);

      // Add some randomization to make bars more lively
      const randomFactor = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
      normalized *= randomFactor;

      // A little wider range: 8% minimum, 92% maximum
      amplitudes.push(Math.min(normalized * 0.84 + 0.08, 1));
    }

    return amplitudes;
  }

  private cleanup() {
    // Stop amplitude monitoring
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clean up audio analysis
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {
        // Ignore audio context close errors
      });
    }
    this.audioContext = null;
    this.analyserNode = null;
    this.amplitudeCallback = null;

    // Clean up recording resources
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.activeAudio = null;
  }
}

const voiceService: VoiceService =
  Platform.OS === "web" ? new WebVoiceService() : new NativeVoiceService();

export default voiceService;
