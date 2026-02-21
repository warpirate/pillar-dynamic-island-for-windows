import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { microInteractions } from "../animations";
import type { PrismChatMessage, PrismUsage } from "../../../types/prism";

interface PrismModuleProps {
  messages: PrismChatMessage[];
  actionMode: boolean;
  usage?: PrismUsage;
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => Promise<void>;
  onToggleActionMode: (enabled: boolean) => void;
  onClearChat: () => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function PrismModule({
  messages,
  actionMode,
  usage: _usage,
  isLoading,
  error,
  onSendMessage,
  onToggleActionMode,
  onClearChat,
}: PrismModuleProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full min-h-0 w-full max-w-full">
      {/* Minimal Header */}
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-shrink-0">
        <span className="text-white/80 text-[11px] uppercase tracking-wider">Prism AI</span>
        <div className="flex items-center gap-1">
          <motion.button
            className={`px-1.5 py-0.5 rounded text-[9px] ${
              actionMode ? "bg-green-500/25 text-green-300" : "bg-white/10 text-white/60"
            }`}
            onClick={() => onToggleActionMode(!actionMode)}
            {...microInteractions.button}
          >
            {actionMode ? "Actions" : "Actions"}
          </motion.button>
          <motion.button
            className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/60 hover:text-white/80"
            onClick={onClearChat}
            {...microInteractions.button}
          >
            Clear
          </motion.button>
        </div>
      </div>

      {/* Unified Chat Container - maximized space */}
      <div className="flex-1 flex flex-col min-h-0 w-full max-w-full rounded-lg bg-black/35 border border-white/10 overflow-hidden">
        {/* Chat Messages Area - maximized scrollable space */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-3 space-y-2.5"
          style={{ 
            scrollbarWidth: 'thin', 
            scrollbarColor: 'rgba(255,255,255,0.2) transparent',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {messages.length === 0 && (
            <div className="text-white/40 text-[12px] leading-relaxed text-center py-12">
              Ask Prism about timer, media, notifications, or settings.
            </div>
          )}

          {messages.map((item) => (
            <div
              key={item.id}
              className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-lg px-3 py-2.5 ${
                  item.role === "user"
                    ? "bg-red-500/30 text-white border border-red-400/50"
                    : "bg-white/20 text-white border border-white/20"
                }`}
              >
                <p className="text-[12px] whitespace-pre-wrap break-words leading-relaxed">{item.content}</p>
                <p className="text-[10px] text-white/35 mt-1 text-right">{formatTime(item.timestamp)}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-[12px] text-white/50 pb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse"></div>
              <span>Prism is thinking...</span>
            </div>
          )}

          {error && (
            <div className="text-[11px] text-red-300 bg-red-500/25 border border-red-500/40 rounded-lg px-3 py-2 mb-2">
              {error}
            </div>
          )}
        </div>

        {/* Input Area - compact at bottom */}
        <div className="flex-shrink-0 border-t border-white/10 p-2 bg-white/5 w-full">
          <form
            className="flex items-center gap-1.5 w-full min-w-0"
            onSubmit={async (e) => {
              e.preventDefault();
              const message = inputValue.trim();
              if (!message || isLoading) return;
              setInputValue("");
              await onSendMessage(message);
            }}
          >
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Prism..."
              rows={1}
              className="flex-1 min-w-0 resize-none rounded-lg bg-white/10 border border-white/15 px-2.5 py-1.5 text-[12px] text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-red-500/40 focus:border-red-500/40 transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const message = inputValue.trim();
                  if (message && !isLoading) {
                    setInputValue("");
                    onSendMessage(message);
                  }
                }
              }}
            />
            <motion.button
              type="submit"
              className="flex-shrink-0 h-[32px] px-3 rounded-lg bg-red-500/40 hover:bg-red-500/50 text-white text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-red-400/30"
              disabled={isLoading || inputValue.trim().length === 0}
              {...microInteractions.button}
            >
              Send
            </motion.button>
          </form>
        </div>
      </div>
    </div>
  );
}
