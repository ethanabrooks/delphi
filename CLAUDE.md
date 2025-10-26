# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Delphi is an Expo React Native app demonstrating OpenAI voice agent capabilities. It features two main modes: a Talk interface for voice interactions and a Todo list manager. The app uses Tamagui for UI components, SQLite with Drizzle ORM for persistence, and Zustand for state management.

## Development Commands

### Core Development
```bash
# Start development server
npm start              # Expo CLI (choose platform)
npm run web            # Web development
npm run ios            # iOS simulator
npm run android        # Android emulator

# Testing
npm test               # Run all tests with Jest
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report

# Code Quality
npm run lint           # Biome linting
npm run format         # Format code
npm run check          # Lint + format + type check
npm run check:fix      # Fix issues automatically
```

### Single Test Execution
```bash
# Run specific test file
npx jest __tests__/TodoStore.test.ts

# Run tests matching pattern
npx jest --testNamePattern="should add todo"
```

## Git Workflow

### Commit Guidelines
**NEVER use `--no-verify` flag when committing.** Git hooks are in place for a reason and must not be bypassed. This includes:
- Pre-commit hooks that run linting and formatting
- Commit message hooks that enforce conventions
- Any other verification steps configured in the repository

Always let hooks run their full verification process. If hooks fail, fix the underlying issues rather than bypassing them.

## Architecture Overview

### State Management
- **Zustand stores** (`stores/`) manage application state
- `simpleTodoStore.ts` handles todo CRUD operations with async loading states
- Store includes computed getters for filtering todos by completion/priority

### Data Layer
- **Drizzle ORM** (`db/schema.ts`) defines typed SQLite schemas
- **TodoService** (`services/todoService.ts`) provides CRUD operations
- Database initialization handled automatically on app start

### Voice System
- **Cross-platform VoiceService** (`services/voiceService.ts`) abstracts recording/playback
  - Native platforms: Expo AV for recording, Expo Speech for TTS
  - Web: MediaRecorder API with OpenAI TTS fallback
- **OpenAI Client** (`services/openaiClient.ts`) provides typed API wrappers with Zod validation
- **ConversationAgent** (`services/conversationAgent.ts`) manages stateful conversations with OpenAI
  - Implements lifecycle methods (`dispose()`) for proper cleanup
  - Exposes observable state (messages, conversationId, counts)
  - Handles context length limits with automatic compaction
- **useConversationAgent hook** (`hooks/useConversationAgent.ts`) provides React lifecycle integration
  - Automatically disposes agent on unmount
  - Recreates agent when API key changes
  - Exposes conversation state and actions
- Talk component handles voice UI and orchestration

#### VoiceService Lifecycle & Resource Management

**Concurrency Guards:**
- `startRecording()` throws if called while recording is already in progress
- `speak()` automatically stops any ongoing speech before starting new speech
- Guards prevent resource leaks from concurrent operations

**Resource Cleanup:**
- `dispose()` method stops all active resources (recording, speech, amplitude monitoring)
- Consumers must call `dispose()` in cleanup (e.g., useEffect return function)
- `stopSpeaking()` should be called before starting new recordings
- `offAmplitudeData()` cancels animation frames for amplitude monitoring

**Proper Usage Pattern:**
```typescript
useEffect(() => {
  // Setup amplitude callback if needed
  if (voiceService.onAmplitudeData) {
    voiceService.onAmplitudeData(callback);
  }

  return () => {
    voiceService.stopSpeaking();      // Stop any ongoing speech
    voiceService.cancelRecording();   // Cancel recording if active
    voiceService.dispose();           // Clean up all resources
  };
}, []);
```

**State Management:**
- Both native and web implementations track `isRecording` and `isSpeaking` states
- State is properly cleared in all cleanup paths (stop, cancel, dispose)
- Error paths ensure state consistency

### UI Architecture
- **Tamagui** components for consistent design system
- Manual screen switching in `App.tsx` (not Expo Router)
- Components automatically initialize required services (database, voice permissions)

### Testing Strategy
- React Native Testing Library for component tests
- Comprehensive mocks in `jest.setup.ts` for Tamagui, SQLite, and platform APIs
- Store operations in tests must be wrapped in `act()` for React compatibility
- Act warnings for component lifecycle updates are intentionally suppressed

## Key Configuration Files

- `jest.config.js` - Test configuration with module aliases and coverage settings
- `biome.json` - Linting and formatting rules
- `tsconfig.json` - TypeScript strict mode configuration
- `package.json` - Scripts use Biome instead of ESLint/Prettier

## OpenAI Integration

The app requires `EXPO_PUBLIC_OPENAI_API_KEY` in `.env` for voice functionality. Demo mode works without API key for UI testing. Voice features are platform-aware and gracefully degrade on unsupported platforms.

## Known Patterns

- Async operations in Zustand stores handle loading/error states manually
- Components use imperative service calls rather than declarative data fetching
- Database schema uses Drizzle's typed approach with custom type annotations
- Tests extensively mock platform-specific APIs to run in Node environment

## Lifecycle Management

### ConversationAgent Lifecycle
The `ConversationAgent` class maintains internal conversation state and requires explicit cleanup:

**Direct Usage (with manual cleanup):**
```typescript
const agent = useMemo(() => new ConversationAgent(apiKey), [apiKey]);

useEffect(() => {
  return () => {
    agent.dispose(); // Clears state and releases resources
  };
}, [agent]);
```

**Recommended: Use the Hook:**
```typescript
const { agent, messages, conversationId, processMessage } =
  useConversationAgent({ apiKey });
// Cleanup handled automatically
```

**Key Methods:**
- `dispose()` - Complete cleanup (clears state, nulls client)
- `clearConversation()` - Resets conversation (preserves client)
- `getConversationState()` - Read-only state snapshot
- `getMessageCount()` - Count non-system messages
- `getLastMessage()` - Get most recent user/assistant message

**Lifecycle Contract:**
1. Agent instances must be disposed when no longer needed
2. Disposal happens automatically on component unmount (when using hook)
3. New agent instance created when API key changes
4. No stale conversation state persists across remounts