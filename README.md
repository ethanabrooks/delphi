# Voice Agent Hello World App

A React Native mobile app demonstrating OpenAI's voice agent capabilities with speech-to-speech functionality.

## Features

- **Basic Voice Agent**: Uses OpenAI's Whisper (speech-to-text), GPT-4o (chat), and text-to-speech APIs
- **Realtime Voice Agent**: Implements OpenAI's Realtime API for low-latency voice conversations
- **Cross-platform**: Runs on iOS, Android, and Web
- **Modern UI**: Built with Tailwind CSS (via NativeWind)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenAI API Key

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Add your API key to `.env`:
   ```
   EXPO_PUBLIC_OPENAI_API_KEY=your_actual_api_key_here
   ```

### 3. Run the App

```bash
# Web (for development)
npm run web

# iOS simulator
npm run ios

# Android emulator
npm run android
```

## Voice Agent Modes

### Basic Voice Agent
- Records audio using device microphone
- Transcribes speech using OpenAI Whisper API
- Generates responses using GPT-4o
- Converts responses to speech using device TTS

### Realtime Voice Agent
- Uses OpenAI's Realtime API via WebSocket
- Streaming audio input/output
- Lower latency conversations
- Handles interruptions naturally
- Real-time transcription

## Usage

1. **Grant Permissions**: Allow microphone access when prompted
2. **Select Mode**: Choose between "Basic Voice" or "Realtime API"
3. **Start Talking**: Press the "Talk" button and speak
4. **Listen**: The AI will respond with voice

## API Requirements

### Basic Voice Agent
- OpenAI Whisper API (speech-to-text)
- OpenAI Chat Completions API (GPT-4o)
- Device text-to-speech capabilities

### Realtime Voice Agent
- OpenAI Realtime API access
- WebSocket connection support
- Real-time audio streaming

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Audio Input   │    │  OpenAI APIs    │    │  Audio Output   │
│  (Microphone)   │───▶│ Whisper/Realtime│───▶│   (Speakers)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Technologies Used

- **React Native + Expo**: Cross-platform mobile framework
- **TypeScript**: Type-safe development
- **Tailwind CSS (NativeWind)**: Utility-first styling
- **Expo AV**: Audio recording and playback
- **Expo Speech**: Text-to-speech functionality
- **OpenAI APIs**: Voice and chat capabilities

## File Structure

```
├── App.tsx                    # Main app component with mode selection
├── VoiceAgent.tsx             # Basic voice agent implementation
├── RealtimeVoiceAgent.tsx     # Realtime API voice agent
├── global.css                 # Tailwind CSS imports
├── tailwind.config.js         # Tailwind configuration
├── metro.config.js            # Metro bundler config for NativeWind
└── .env.example               # Environment variables template
```

## Demo Mode

The app works in demo mode without an API key - it will simulate voice interactions for testing the UI and basic functionality.

## Troubleshooting

### Permission Issues
- Ensure microphone permissions are granted
- Check device audio settings

### API Issues
- Verify your OpenAI API key is valid
- Check you have sufficient API credits
- Ensure network connectivity

### Audio Issues
- Test with device speakers/headphones
- Check volume levels
- Verify audio codec support

## Next Steps

- Add conversation history
- Implement function calling
- Add custom voice options
- Integrate with external APIs
- Add offline mode support