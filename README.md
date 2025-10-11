# Delphi Voice + Todo Starter

A modern Expo 54 application that showcases a cross-platform voice assistant and a SQLite-backed todo list, sharing a single Tamagui-powered UI. The voice experience runs on Expo's native audio stack while the todo workflow uses a platform-aware data layer so it works both on-device and in the browser.

## What’s Inside

- **Expo Router navigation** with two tabs (`Talk`, `Todo`) instead of manual screen toggles.
- **Voice service** built on `expo-av`/`expo-speech`, with Web fallbacks, and typed OpenAI client responses (validated through Zod).
- **Typed data access layer** using Expo SQLite + Drizzle ORM on native and `localStorage` mirroring on the web.
- **Async orchestration hook** (`useTodosManager`) that replaces the prior Zustand store while keeping tests in sync.
- **Tamagui design system** for shared theming and layout across screens.
- **Biome + Jest** for linting and tests, already wired into Husky pre-commit hooks.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure your OpenAI key**
   ```bash
   cp .env.example .env
   # edit .env
   EXPO_PUBLIC_OPENAI_API_KEY=sk-...
   ```

3. **Run the app**
   ```bash
   # Pick the platform you need
   npm run start     # QR menu
   npm run ios       # iOS simulator
   npm run android   # Android emulator
   npm run web       # Web preview
   ```

> The Talk tab works in demo mode when no API key is present—it records/plays locally and returns canned responses.

## Navigation & Screens

- `app/_layout.tsx` defines a Tab router that wraps the app in `TamaguiProvider`.
- `app/talk.tsx` renders `components/Talk`, passing the configured API key.
- `app/todo.tsx` renders `components/TodoList`, which is now powered by `hooks/useTodosManager`.

## Voice Flow

1. `hooks/useTalkController` orchestrates recording (native + web), transcription, chat completion, and text-to-speech.
2. `services/openaiClient` fetches Whisper + GPT-4o responses and validates payloads with Zod.
3. `services/voiceService` abstracts native vs. web recording/playback so the UI works everywhere.

## Todo Flow

1. `services/platformTodoService` selects the appropriate persistence backend (Expo SQLite on native, `localStorage` on web).
2. `hooks/useTodosManager` handles query/load/mutation state and exposes derived stats.
3. `components/TodoList` consumes the hook, keeping the UI declarative.

## Testing

- `npm test` runs all Jest suites (in-band to play nicely with the sandbox).
- Notable suites: `__tests__/useTodosManager.test.tsx`, `__tests__/TodoIntegration.test.ts`, and the Tamagui-render smoke tests.
- Husky’s pre-commit hook runs Biome + Jest automatically, so expect commits to fail if tests or linting break.

## Linting & Formatting

- `npm run lint` → Biome lint
- `npm run format` → Biome format (read-only)
- `npm run format:fix` → Biome format with writes

## Updated File Structure

```
app/
  _layout.tsx         # Tab layout + Tamagui provider
  talk.tsx            # Talk screen entry
  todo.tsx            # Todo screen entry
components/
  Talk.tsx
  TodoList.tsx
hooks/
  useTalkController.ts
  useTodosManager.ts
services/
  openaiClient.ts
  voiceService.ts
  platformTodoService.ts
  todoService.ts
```

## Troubleshooting

- **`npm install` fails**: the project requires Node 20+. A portable Node binary is bundled in the automation scripts if needed.
- **Voice tab muted on web**: ensure the browser allows microphone access; the hook falls back to Web Speech when OpenAI TTS errors.
- **SQLite schema issues**: delete the Expo SQLite DB from the simulator/device or clear browser storage for web to reset state.

## Next Steps

- Swap the custom todo hook for `@tanstack/react-query` once package installation is possible.
- Extend docs with architecture diagrams inspired by the new layout.
- Add end-to-end coverage around the router to verify tab transitions.
