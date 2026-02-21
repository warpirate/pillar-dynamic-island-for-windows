export const MAX_CHAT_MESSAGES = 12;
export const MAX_MESSAGE_CHARS = 800;
export const MAX_CONTEXT_CHARS = 1800;
export const MAX_NOTIFICATIONS_IN_CONTEXT = 3;
export const MAX_AUDIO_SESSIONS_IN_CONTEXT = 4;

export type PrismRole = "user" | "assistant";

export interface PrismChatMessage {
  id: string;
  role: PrismRole;
  content: string;
  timestamp: number;
}

export interface PrismContextBlock {
  kind: string;
  content: string;
}

export interface PrismAction {
  id?: string;
  type: string;
  label?: string;
  description?: string;
  args?: Record<string, unknown>;
}

export interface PrismChatRequest {
  userMessage: string;
  conversation: Array<{ role: PrismRole; content: string }>;
  contextBlocks: PrismContextBlock[];
  allowActions: boolean;
}

export interface PrismUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface PrismChatResponse {
  reply: string;
  actions?: PrismAction[];
  usage?: PrismUsage;
}
