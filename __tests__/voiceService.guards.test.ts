import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Mock Platform before importing voiceService
jest.mock("react-native", () => ({
  Platform: {
    OS: "web",
    select: jest.fn((obj: { web?: unknown; native?: unknown }) => obj.web),
  },
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock expo-audio
jest.mock("expo-audio", () => ({
  AudioModule: {
    AudioRecorder: jest.fn(),
  },
  RecordingPresets: {
    HIGH_QUALITY: {},
  },
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));

// Mock expo-speech
jest.mock("expo-speech", () => ({
  stop: jest.fn(),
  speak: jest.fn(),
}));

describe("VoiceService Guards", () => {
  let mockMediaStream: MediaStream;
  let mockMediaRecorder: {
    start: jest.Mock;
    stop: jest.Mock;
    ondataavailable: ((event: BlobEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onstop: (() => void) | null;
    state: string;
    mimeType: string;
  };
  let mockAudioContext: AudioContext;
  let getUserMediaMock: jest.Mock;
  let cancelAnimationFrameMock: jest.Mock;

  beforeEach(() => {
    // Reset all mocks and modules to get fresh voiceService instance
    jest.clearAllMocks();
    jest.resetModules();

    // Mock SpeechSynthesisUtterance
    (global as any).SpeechSynthesisUtterance = jest.fn(function (
      this: any,
      text: string
    ) {
      this.text = text;
      this.rate = 1.0;
      this.onend = null;
      this.onerror = null;
    });

    // Mock MediaStream with fresh track mock for each test
    const trackStopMock = jest.fn();
    mockMediaStream = {
      getTracks: jest.fn(() => [
        { stop: trackStopMock } as unknown as MediaStreamTrack,
      ]),
    } as unknown as MediaStream;

    // Mock MediaRecorder - create a fresh factory that returns fresh instance
    const stopMock = jest.fn<() => void>(function (this: any) {
      // Simulate async stop by calling onstop callback
      setTimeout(() => {
        if (this.onstop) {
          this.onstop();
        }
      }, 0);
    });

    mockMediaRecorder = {
      start: jest.fn(),
      stop: stopMock,
      ondataavailable: null,
      onerror: null,
      onstop: null,
      state: "inactive",
      mimeType: "audio/webm",
    };

    global.MediaRecorder = jest.fn(
      () => mockMediaRecorder
    ) as unknown as typeof MediaRecorder;

    // Mock getUserMedia
    getUserMediaMock = jest
      .fn<() => Promise<MediaStream>>()
      .mockResolvedValue(mockMediaStream);
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        getUserMedia: getUserMediaMock,
      },
      writable: true,
      configurable: true,
    });

    // Mock AudioContext
    const mockAnalyserNode = {
      fftSize: 0,
      smoothingTimeConstant: 0,
      minDecibels: 0,
      maxDecibels: 0,
      frequencyBinCount: 256,
      getByteFrequencyData: jest.fn(),
    } as unknown as AnalyserNode;

    const mockSourceNode = {
      connect: jest.fn(),
    } as unknown as MediaStreamAudioSourceNode;

    mockAudioContext = {
      createAnalyser: jest.fn(() => mockAnalyserNode),
      createMediaStreamSource: jest.fn(() => mockSourceNode),
      close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      state: "running",
    } as unknown as AudioContext;

    (global as any).AudioContext = jest.fn(() => mockAudioContext);
    (global as any).webkitAudioContext = jest.fn(() => mockAudioContext);

    // Mock animation frame functions
    cancelAnimationFrameMock = jest.fn();
    const requestAnimationFrameMock = (cb: FrameRequestCallback) => {
      setTimeout(() => cb(0), 0);
      return 1;
    };

    global.cancelAnimationFrame = cancelAnimationFrameMock;
    global.requestAnimationFrame =
      requestAnimationFrameMock as unknown as typeof requestAnimationFrame;

    // Mock window.Audio
    (global as any).Audio = jest.fn(() => ({
      play: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      pause: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      currentTime: 0,
    }));

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = jest.fn();
  });

  test("concurrent recording guard prevents double startRecording", async () => {
    // Import after mocks are configured
    const { default: voiceService } = require("../services/voiceService");

    // Start recording
    await voiceService.startRecording();
    expect(getUserMediaMock).toHaveBeenCalledTimes(1);

    // Attempt to start recording again while already recording
    await expect(voiceService.startRecording()).rejects.toThrow(
      "Recording already in progress. Call stopRecording() or cancelRecording() first."
    );

    // Verify getUserMedia was not called again
    expect(getUserMediaMock).toHaveBeenCalledTimes(1);

    // Cleanup
    await voiceService.cancelRecording();
  });

  test("dispose method stops recording and clears all resources", async () => {
    const { default: voiceService } = require("../services/voiceService");

    // Start recording to create resources
    await voiceService.startRecording();

    // Set up amplitude monitoring
    const amplitudeCallback = jest.fn();
    if (voiceService.onAmplitudeData) {
      voiceService.onAmplitudeData(amplitudeCallback);
    }

    // Get the track stop mock before dispose
    const tracks = mockMediaStream.getTracks();
    const trackStopMock = tracks[0].stop;

    // Call dispose
    voiceService.dispose();

    // Verify cleanup happened
    // dispose() calls cleanup() which stops tracks and closes audio context
    // but does NOT call mediaRecorder.stop() - it just nulls it out
    expect(trackStopMock).toHaveBeenCalled();
    expect(mockAudioContext.close).toHaveBeenCalled();
    expect(cancelAnimationFrameMock).toHaveBeenCalled();

    // Verify we can start recording again after dispose
    await voiceService.startRecording();
    expect(getUserMediaMock).toHaveBeenCalledTimes(2);

    // Cleanup
    await voiceService.cancelRecording();
  });

  test("stopSpeaking clears isSpeaking state and stops audio", async () => {
    const { default: voiceService } = require("../services/voiceService");

    // Mock speechSynthesis
    const cancelMock = jest.fn();
    Object.defineProperty(global.window, "speechSynthesis", {
      value: {
        speak: jest.fn(),
        cancel: cancelMock,
      },
      writable: true,
      configurable: true,
    });

    // Start speaking (without API key, uses Web Speech API)
    const speakPromise = voiceService.speak("Test message");

    // Stop speaking
    voiceService.stopSpeaking();

    // Verify cancel was called
    expect(cancelMock).toHaveBeenCalled();

    // Wait for speak promise to resolve
    await speakPromise;

    // Verify we can speak again (isSpeaking was cleared)
    await voiceService.speak("Another message");
    // Cancel should be called once from explicit stopSpeaking
    // (second speak doesn't auto-stop since isSpeaking is already false)
    expect(cancelMock).toHaveBeenCalledTimes(1);
  });

  test("offAmplitudeData cancels animation frame and clears callback", async () => {
    const { default: voiceService } = require("../services/voiceService");

    // Start recording to set up amplitude monitoring
    await voiceService.startRecording();

    const amplitudeCallback = jest.fn();

    // Set up amplitude callback
    if (voiceService.onAmplitudeData) {
      voiceService.onAmplitudeData(amplitudeCallback);
    }

    // Give animation frame a chance to run
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Clear the callback
    if (voiceService.offAmplitudeData) {
      voiceService.offAmplitudeData();
    }

    // Verify animation frame was cancelled
    expect(cancelAnimationFrameMock).toHaveBeenCalled();

    // Cleanup
    await voiceService.cancelRecording();
  });

  test("cancelRecording cleans up resources without throwing", async () => {
    const { default: voiceService } = require("../services/voiceService");

    // Start recording
    await voiceService.startRecording();

    // Get references to mocks before cancel
    const tracks = mockMediaStream.getTracks();
    const trackStopMock = tracks[0].stop;

    // Cancel recording
    await voiceService.cancelRecording();

    // Verify cleanup happened
    // cancelRecording calls mediaRecorder.stop() and then cleanup()
    expect(mockMediaRecorder.stop).toHaveBeenCalled();
    expect(trackStopMock).toHaveBeenCalled();

    // Verify we can start recording again
    await voiceService.startRecording();
    expect(getUserMediaMock).toHaveBeenCalledTimes(2);

    // Cleanup
    await voiceService.cancelRecording();
  });

  test("speak automatically stops ongoing speech before starting new speech", async () => {
    const { default: voiceService } = require("../services/voiceService");

    const cancelMock = jest.fn();
    Object.defineProperty(global.window, "speechSynthesis", {
      value: {
        speak: jest.fn(),
        cancel: cancelMock,
      },
      writable: true,
      configurable: true,
    });

    // Start first speech
    const firstSpeak = voiceService.speak("First message");

    // Start second speech without explicitly stopping first
    // This should automatically call stopSpeaking() which calls cancel()
    const secondSpeak = voiceService.speak("Second message");

    // Verify cancel was called once from the auto-stop in second speak()
    expect(cancelMock).toHaveBeenCalledTimes(1);

    await Promise.all([firstSpeak, secondSpeak]);
  });

  test("dispose is idempotent and safe to call multiple times", async () => {
    const { default: voiceService } = require("../services/voiceService");

    // Call dispose multiple times
    voiceService.dispose();
    voiceService.dispose();
    voiceService.dispose();

    // Should not throw
    expect(true).toBe(true);

    // Service should still be functional
    await voiceService.startRecording();
    await voiceService.cancelRecording();
  });
});
