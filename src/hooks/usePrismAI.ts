import { useCallback, useEffect, useRef, useState } from "react";
import { buildPrismContext, type PrismContextSource } from "../lib/prismContext";
import { tauriInvoke } from "../lib/tauri";
import {
  MAX_CHAT_MESSAGES,
  MAX_MESSAGE_CHARS,
  type PrismAction,
  type PrismChatMessage,
  type PrismChatResponse,
} from "../types/prism";

interface UsePrismAIReturn {
  messages: PrismChatMessage[];
  actions: PrismAction[];
  actionMode: boolean;
  usage: PrismChatResponse["usage"];
  isLoading: boolean;
  error: string | null;
  setActionMode: (enabled: boolean) => void;
  setActions: (actions: PrismAction[] | ((prev: PrismAction[]) => PrismAction[])) => void;
  clearChat: () => void;
  sendMessage: (message: string) => Promise<void>;
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
}

function createMessage(role: PrismChatMessage["role"], content: string): PrismChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

function trimMessages(messages: PrismChatMessage[]): PrismChatMessage[] {
  return messages.slice(-MAX_CHAT_MESSAGES);
}

export function usePrismAI(source: PrismContextSource): UsePrismAIReturn {
  const [messages, setMessages] = useState<PrismChatMessage[]>([]);
  const [actions, setActions] = useState<PrismAction[]>([]);
  const [actionMode, setActionMode] = useState(false);
  const [usage, setUsage] = useState<PrismChatResponse["usage"]>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef(messages);
  const sourceRef = useRef(source);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setActions([]);
    setUsage(undefined);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    const trimmedMessage = truncate(message.trim(), MAX_MESSAGE_CHARS);
    if (!trimmedMessage || isLoading) return;

    const userMessage = createMessage("user", trimmedMessage);
    const previousMessages = trimMessages(messagesRef.current);
    const pendingMessages = trimMessages([...previousMessages, userMessage]);

    setMessages(pendingMessages);
    setActions([]);
    setError(null);
    setIsLoading(true);

    try {
      const response = await tauriInvoke<{
        reply: string;
        actions?: Array<{
          id?: string;
          type: string;
          label?: string;
          description?: string;
          args?: Record<string, unknown>;
        }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      }>("prism_chat", {
        request: {
          userMessage: trimmedMessage,
          conversation: previousMessages.map((item) => ({
            role: item.role,
            content: truncate(item.content, MAX_MESSAGE_CHARS),
          })),
          contextBlocks: buildPrismContext(trimmedMessage, sourceRef.current),
          allowActions: actionMode,
        },
      });

      if (!response) {
        setError("Prism request failed. Check your network or GROQ_API_KEY.");
        return;
      }

      const assistantText = (response.reply || "").trim();
      if (!assistantText) {
        setError("Prism returned an empty response.");
        return;
      }

      const assistantMessage = createMessage(
        "assistant",
        truncate(assistantText, MAX_MESSAGE_CHARS)
      );
      const nextMessages = trimMessages([...pendingMessages, assistantMessage]);
      setMessages(nextMessages);
      setActions(response.actions ?? []);
      setUsage(
        response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined
      );
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : typeof (e as { message?: string })?.message === "string"
              ? (e as { message: string }).message
              : "Unexpected Prism error.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [actionMode, isLoading]);

  return {
    messages,
    actions,
    actionMode,
    usage,
    isLoading,
    error,
    setActionMode,
    setActions,
    clearChat,
    sendMessage,
  };
}
