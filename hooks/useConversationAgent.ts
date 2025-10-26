import { useEffect, useMemo, useRef, useState } from "react";
import {
  ConversationAgent,
  type ConversationState,
} from "../services/conversationAgent";
import type { ChatCompletionMessage } from "../services/openaiClient";

export interface UseConversationAgentOptions {
  apiKey?: string;
}

export interface UseConversationAgentResult {
  agent: ConversationAgent;
  conversationId: string | undefined;
  messages: ChatCompletionMessage[];
  messageCount: number;
  lastMessage: ChatCompletionMessage | undefined;
  processMessage: (userMessage: string) => Promise<string>;
  clearConversation: () => Promise<void>;
}

/**
 * Hook that manages a ConversationAgent lifecycle with proper cleanup.
 * Creates a new agent when apiKey changes and disposes of the old one.
 * Automatically disposes of the agent on component unmount.
 */
export function useConversationAgent({
  apiKey,
}: UseConversationAgentOptions): UseConversationAgentResult {
  // Use ref to track the agent instance for disposal
  const agentRef = useRef<ConversationAgent | null>(null);

  // Create or recreate agent when apiKey changes
  const agent = useMemo(() => {
    // Dispose of previous agent if it exists
    if (agentRef.current) {
      agentRef.current.dispose();
    }

    const newAgent = new ConversationAgent(apiKey);
    agentRef.current = newAgent;
    return newAgent;
  }, [apiKey]);

  // Observable state from the agent
  const [conversationState, setConversationState] = useState<ConversationState>(
    () => agent.getConversationState()
  );

  // Update observable state after each message processing
  // We use a counter to force re-renders when conversation state changes
  const [updateCounter, setUpdateCounter] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: updateCounter is intentionally used to trigger updates
  useEffect(() => {
    setConversationState(agent.getConversationState());
  }, [agent, updateCounter]);

  // Wrap processMessage to trigger state updates
  const processMessage = async (userMessage: string): Promise<string> => {
    const response = await agent.processMessage(userMessage);
    setUpdateCounter((c) => c + 1);
    return response;
  };

  // Wrap clearConversation to trigger state updates
  const clearConversation = async (): Promise<void> => {
    await agent.clearConversation();
    setUpdateCounter((c) => c + 1);
  };

  // Dispose of agent on unmount
  useEffect(() => {
    return () => {
      if (agentRef.current) {
        agentRef.current.dispose();
        agentRef.current = null;
      }
    };
  }, []);

  return {
    agent,
    conversationId: conversationState.conversationId,
    messages: conversationState.messages,
    messageCount: agent.getMessageCount(),
    lastMessage: agent.getLastMessage(),
    processMessage,
    clearConversation,
  };
}

export default useConversationAgent;
