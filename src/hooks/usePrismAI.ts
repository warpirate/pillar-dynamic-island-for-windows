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

const PRISM_MESSAGES_KEY = "pillar_prism_messages_v1";
const PRISM_ACTION_MODE_KEY = "pillar_prism_action_mode_v1";
const MIN_ACTION_CONFIDENCE = 0.6;

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

function parseConfidence(action: {
  description?: string;
  args?: Record<string, unknown>;
  confidence?: number;
}): number {
  if (typeof action.confidence === "number") {
    return Math.max(0, Math.min(1, action.confidence));
  }
  if (typeof action.args?.confidence === "number") {
    return Math.max(0, Math.min(1, action.args.confidence as number));
  }
  if (typeof action.args?.confidence === "string") {
    const parsed = Number(action.args.confidence);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed));
  }
  if (typeof action.description === "string") {
    const match = action.description.match(/confidence[:\s]+(0(?:\.\d+)?|1(?:\.0+)?)/i);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed));
    }
  }
  return 0.5;
}

export function usePrismAI(source: PrismContextSource): UsePrismAIReturn {
  const [messages, setMessages] = useState<PrismChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(PRISM_MESSAGES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PrismChatMessage[];
      if (!Array.isArray(parsed)) return [];
      return trimMessages(parsed);
    } catch {
      return [];
    }
  });
  const [actions, setActions] = useState<PrismAction[]>([]);
  const [actionMode, setActionMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PRISM_ACTION_MODE_KEY) === "true";
    } catch {
      return false;
    }
  });
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

  useEffect(() => {
    try {
      localStorage.setItem(PRISM_MESSAGES_KEY, JSON.stringify(trimMessages(messages)));
    } catch {
      // ignore storage errors
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(PRISM_ACTION_MODE_KEY, String(actionMode));
    } catch {
      // ignore storage errors
    }
  }, [actionMode]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setActions([]);
    setUsage(undefined);
    setError(null);
    try {
      localStorage.removeItem(PRISM_MESSAGES_KEY);
    } catch {
      // ignore storage errors
    }
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
      const normalizedActions = (response.actions ?? []).map((action) => ({
        ...action,
        confidence: parseConfidence(action),
      }));
      const safeActions = normalizedActions.filter(
        (action) => (action.confidence ?? 0) >= MIN_ACTION_CONFIDENCE
      );
      setActions(safeActions);
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
