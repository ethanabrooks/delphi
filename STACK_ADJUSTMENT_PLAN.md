# Stack Adjustment Plan

## Current Alignment
- Expo + React Native + TypeScript provide a modern, type-safe foundation (`strict` TS config) that fits the project goals.
- Drizzle ORM with Expo SQLite keeps persistence typed and portable across mobile platforms.
- Tamagui delivers a modern design system, but it diverges from the most conventional Expo stack patterns.
- Voice capture and playback depend on browser-only APIs (MediaRecorder, Web Speech), so the current implementation does not meet the mobile-first objective.

## Recommended Adjustments
1. **Adopt native-friendly audio primitives**: Rebuild recording and playback with `expo-av` (for microphone capture and audio playback) and `expo-speech` or OpenAI streaming playback so the voice flow works seamlessly on iOS.
2. **Wrap OpenAI API calls in typed helpers**: Introduce thin service modules that handle fetch requests and parse responses with `zod` schemas or the official `openai` SDK to eliminate `any`-typed data.
3. **Align navigation with Expo conventions**: Replace the manual `useState` screen switcher with Expo Router for scalable, conventional navigation patterns.
4. **Leverage a data-fetching/state library**: Consider `@tanstack/react-query` (or Expo Query) to manage async state for todos rather than hand-rolled loading/error booleans in the Zustand store.
5. **Refresh documentation**: Update README and onboarding docs to reflect Tamagui usage instead of the current NativeWind references.

## Next Steps
1. Prototype the native audio service and integrate it into the Talk screen.
2. Refactor the Talk component to consume the new voice service and typed OpenAI helpers.
3. Decide on adopting Expo Router and/or React Query before expanding features further.
