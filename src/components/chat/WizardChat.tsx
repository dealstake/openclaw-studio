"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, Square, Sparkles } from "lucide-react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ErrorBanner } from "@/components/ErrorBanner";
import { cn } from "@/lib/utils";
import {
  useWizardSession,
  type UseWizardSessionOptions,
} from "@/components/chat/hooks/useWizardSession";
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
  className?: string;
  /** Pre-filled prompt auto-sent on mount (e.g., from integration setup) */
  initialPrompt?: string;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * Module-level counter for stable message keys across renders.
 * Intentionally persists across mount/unmount cycles — ensures unique keys
 * even if multiple WizardChat instances mount concurrently.
 */
let wizardMsgIdCounter = 0;

export const WizardChat = React.memo(function WizardChat({
  client,
  agentId,
  wizardType,
  systemPrompt,
  starters,
  onConfigExtracted,
  configExtractor,
  className,
  initialPrompt,
}: WizardChatProps) {
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
  const msgIdsRef = useRef<number[]>([]);

  // Assign stable IDs as messages grow
  while (msgIdsRef.current.length < messages.length) {
    msgIdsRef.current.push(++wizardMsgIdCounter);
  }

  // Auto-scroll on new messages or streaming text
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, thinkingTrace]);

  // Auto-send initialPrompt on mount
  const initialPromptSentRef = useRef(false);
  useEffect(() => {
    if (initialPrompt && !initialPromptSentRef.current) {
      initialPromptSentRef.current = true;
      void sendMessage(initialPrompt);
    }
  }, [initialPrompt, sendMessage]);

  // Cleanup wizard session on unmount — abort streaming first to avoid race
  useEffect(() => {
    return () => {
      void Promise.resolve(abort()).then(cleanup);
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
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        role="log"
        aria-live="polite"
        aria-label="Wizard conversation"
      >
        {/* Welcome / starters */}
        {showStarters && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles size={16} strokeWidth={1.75} className="text-muted-foreground" />
              <span className="text-sm font-medium">
                What would you like to create?
              </span>
            </div>
            <div
              className="flex flex-wrap justify-center gap-2"
              aria-label="Conversation starters"
            >
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
          <MessageBubble key={msgIdsRef.current[i]} role={msg.role} content={msg.content} />
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
        {error && <ErrorBanner message={error} />}

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
