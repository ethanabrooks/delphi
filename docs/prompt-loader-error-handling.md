# Prompt Loader Error Handling

## Overview

The `ConversationAgent` service has been hardened to handle prompt template loading failures gracefully. When prompt templates cannot be loaded from assets (due to file system issues, missing files, or other errors), the agent falls back to sensible default prompts instead of crashing the application.

## Implementation

### System Prompt Fallback

**Location:** [services/conversationAgent.ts](../services/conversationAgent.ts) - `buildSystemPrompt()` method

When `readSystemPromptTemplate()` fails, the agent uses a minimal system prompt that includes:
- Basic assistant identity and purpose
- Current date/time context
- Active todos context (if successfully loaded)
- Tool usage instructions

```typescript
try {
  return await readSystemPromptTemplate({
    currentDateTime,
    activeTodosContext,
  });
} catch (error) {
  console.warn("Failed to load system prompt template, using fallback:", error);
  return `You are a helpful AI assistant that manages a todo list. The current date and time is: ${currentDateTime}.${activeTodosContext}

You have access to tools to help users manage their todos. Be concise and helpful.`;
}
```

### Summarization Prompt Fallback

**Location:** [services/conversationAgent.ts](../services/conversationAgent.ts) - `compactConversation()` method

When `readSummarizationPromptTemplate()` fails during conversation compaction, the agent uses a fallback summarization prompt that requests:
- Concise 2-3 sentence summaries
- Focus on key decisions and actions
- Important context preservation

```typescript
try {
  summarizationPrompt = await readSummarizationPromptTemplate({
    conversationHistory,
  });
} catch (error) {
  console.warn("Failed to load summarization prompt template, using fallback:", error);
  summarizationPrompt = `Please provide a concise summary of the following conversation history in 2-3 sentences, focusing on key decisions, actions taken, and important context:\n\n${conversationHistory}`;
}
```

## Error Logging

All template loading failures are logged to the console using `console.warn()` with:
- Descriptive message indicating which template failed
- The original error for debugging

This provides visibility for diagnostics without crashing the application.

## Testing

Comprehensive tests cover all error scenarios:

- **`buildSystemPrompt` fallback:** Verifies that system prompt failures result in a working fallback prompt
- **Active todos context:** Confirms that the fallback includes todos context when available
- **Summarization fallback:** Tests that conversation compaction works even when the summarization template fails
- **Normal operation:** Ensures that successful template loading continues to work as expected

See [__tests__/conversationAgent.promptLoading.test.ts](../__tests__/conversationAgent.promptLoading.test.ts) for test implementation details.

## Product Requirements

### Fallback Prompt Content

The fallback prompts meet the following requirements:

1. **Functional:** Agents can still process user requests and execute tools
2. **Contextual:** Include essential context (date/time, todos, etc.)
3. **Safe:** No inappropriate or unexpected behavior
4. **Minimal:** Short and efficient to reduce token usage

### User Experience

From the user's perspective:
- No visible errors or crashes
- Agent continues to function normally
- Slightly less optimized prompts (acceptable degradation)
- Logging provides debugging information for developers

## Best Practices for Consumers

When integrating with the Conversation Agent:

1. **Monitor Logs:** Watch for template loading warnings in development
2. **Test Template Changes:** Verify templates load correctly after modifications
3. **Handle Gracefully:** Don't assume template loading will always succeed
4. **Document Fallbacks:** Keep fallback prompts updated as features evolve

## Related Files

- [services/conversationAgent.ts](../services/conversationAgent.ts) - Main implementation
- [services/promptLoader.ts](../services/promptLoader.ts) - Template loading utilities
- [__tests__/conversationAgent.promptLoading.test.ts](../__tests__/conversationAgent.promptLoading.test.ts) - Error handling tests
- [prompts/conversation-agent-system-prompt.txt](../prompts/conversation-agent-system-prompt.txt) - System prompt template
- [prompts/conversation-summarization-prompt.txt](../prompts/conversation-summarization-prompt.txt) - Summarization prompt template

## Audit Compliance

This implementation addresses the recommendations from:
- `supporting-services-audit.md`
- `AUDIT_SUMMARY.md`

The hardening ensures that prompt loading failures surface graceful fallbacks instead of crashing the app, improving overall reliability and user experience.
