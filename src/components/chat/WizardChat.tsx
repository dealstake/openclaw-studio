"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, Square, Sparkles } from "lucide-react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { cn } from "@/lib/utils";
import {
  useWizardSession,
  type UseWizardSessionOptions,
} from "@/components/chat/useWizardSession";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

// ── Types ──────────────────────────────────────────────────────────────

export type WizardStarter = {
  prompt: string;
  text: string;
};

export type WizardChatProps = {
  client: GatewayClient;
  agentId: string;
  wizardType: "task" | "project" | "agent";
  systemPrompt: string;
  starters?: WizardStarter[];
  onConfigExtracted?: (config: unknown) => void;
  configExtractor?: (text: string) => unknown | null;
  onComplete?: () => void;
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────

export const WizardChat = React.memo(function WizardChat({
  client,
  agentId,
  wizardType,
  systemPrompt,
  starters,
  onConfigExtracted,
  configExtractor,
  onComplete: _onComplete = undefined,
  className,
}: WizardChatProps) {
  void _onComplete; // Reserved for future use
  const {
    messages,
    streamText,
    thinkingTrace,
    isStreaming,
    error,
    sendMessage,
    abort,
    cleanup,
  } = useWizardSession({
    client,
    agentId,
    wizardType,
    systemPrompt,
    onConfigExtracted,
    configExtractor,
  } satisfies UseWizardSessionOptions);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or streaming text
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, thinkingTrace]);

  // Cleanup wizard session on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-resize textarea
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    [],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleStarterClick = useCallback(
    (prompt: string) => {
      if (isStreaming) return;
      sendMessage(prompt);
    },
    [isStreaming, sendMessage],
  );

  const showStarters = messages.length === 0 && !isStreaming && starters && starters.length > 0;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Welcome / starters */}
        {showStarters && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles size={16} strokeWidth={1.75} className="text-muted-foreground" />
              <span className="text-sm font-medium">
                What would you like to create?
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => handleStarterClick(s.prompt)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}

        {/* Thinking trace (while streaming) */}
        {thinkingTrace && (
          <ThinkingBlock
            text={thinkingTrace}
            streaming={isStreaming}
            className="ml-0"
          />
        )}

        {/* Streaming assistant text */}
        {streamText && (
          <MessageBubble role="assistant" content={streamText} streaming />
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input composer ── */}
      <div className="shrink-0 border-t border-border bg-card/50 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you need..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={abort}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
              aria-label="Stop generating"
            >
              <Square size={16} strokeWidth={1.75} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-text transition-colors hover:bg-primary/20 disabled:opacity-30"
              aria-label="Send message"
            >
              <Send size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// WizardMessageBubble removed — now uses shared MessageBubble from @/components/chat/MessageBubble
