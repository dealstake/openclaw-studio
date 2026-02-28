"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, EventFrame } from "@/lib/gateway/GatewayClient";
import type { WizardContext, WizardType, WizardExtractedConfig } from "../lib/wizardTypes";
import { getWizardTheme, getWizardStarters } from "../lib/wizardThemes";
import { createConfigExtractor } from "@/components/chat/wizardConfigExtractor";

// ── Types ──────────────────────────────────────────────────────────────

export type WizardMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  wizardType: WizardType;
  timestamp: number;
};

export type UseWizardInChatOptions = {
  client: GatewayClient;
  agentId: string;
  onConfigExtracted?: (extracted: WizardExtractedConfig) => void;
};

export type UseWizardInChatReturn = {
  /** Active wizard context, null when no wizard running */
  wizardContext: WizardContext | null;
  /** All wizard messages (both user and assistant) */
  messages: WizardMessage[];
  /** Current streaming text from assistant */
  streamText: string | null;
  /** Current thinking/reasoning trace */
  thinkingTrace: string | null;
  /** Whether the wizard session is currently streaming */
  isStreaming: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Most recently extracted config (null until extraction succeeds) */
  extractedConfig: WizardExtractedConfig | null;
  /** Start a wizard session */
  startWizard: (type: WizardType, systemPrompt: string) => void;
  /** Send a message in the active wizard session */
  sendMessage: (text: string) => Promise<void>;
  /** End the active wizard session and clean up */
  endWizard: () => Promise<void>;
  /** Abort the current streaming response */
  abort: () => Promise<void>;
};

// ── Hook ───────────────────────────────────────────────────────────────

/**
 * Manages a wizard lifecycle within the main chat.
 *
 * Creates an isolated gateway session for the wizard conversation,
 * routes messages through it, runs config extraction on assistant
 * responses, and exposes state for rendering inline in the main chat.
 *
 * Unlike `useWizardSession` (used by modals), this hook:
 * - Manages its own WizardContext lifecycle
 * - Tracks messages with IDs and timestamps for main chat rendering
 * - Supports starting/ending wizards dynamically
 * - Stores extracted configs for inline preview cards
 */
export function useWizardInChat({
  client,
  agentId,
  onConfigExtracted,
}: UseWizardInChatOptions): UseWizardInChatReturn {
  const [wizardContext, setWizardContext] = useState<WizardContext | null>(null);
  const [messages, setMessages] = useState<WizardMessage[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [thinkingTrace, setThinkingTrace] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedConfig, setExtractedConfig] = useState<WizardExtractedConfig | null>(null);

  const sessionInitRef = useRef(false);
  const cleanedUpRef = useRef(false);
  const wizardContextRef = useRef<WizardContext | null>(null);
  const onConfigExtractedRef = useRef(onConfigExtracted);

  // Keep callback ref current
  useEffect(() => {
    onConfigExtractedRef.current = onConfigExtracted;
  }, [onConfigExtracted]);

  // Keep context ref in sync
  useEffect(() => {
    wizardContextRef.current = wizardContext;
  }, [wizardContext]);

  // ── Event subscription ─────────────────────────────────────────────

  useEffect(() => {
    const unsub = client.onEvent((event: EventFrame) => {
      const ctx = wizardContextRef.current;
      if (!ctx) return;

      if (event.event !== "runtime.chat" && event.event !== "runtime.agent") return;

      const payload = event.payload as Record<string, unknown> | undefined;
      if (!payload) return;
      if (payload.sessionKey !== ctx.sessionKey) return;

      // ── runtime.agent events ──
      if (event.event === "runtime.agent") {
        const stream = typeof payload.stream === "string" ? payload.stream : "";
        const data =
          payload.data && typeof payload.data === "object"
            ? (payload.data as Record<string, unknown>)
            : null;

        if (stream === "thinking" || stream === "reasoning" || stream === "extended_thinking") {
          const delta = typeof data?.delta === "string" ? data.delta : "";
          const text = typeof data?.text === "string" ? data.text : "";
          if (text) {
            setThinkingTrace(text);
          } else if (delta) {
            setThinkingTrace((prev) => (prev ?? "") + delta);
          }
          setIsStreaming(true);
          return;
        }

        if (stream === "assistant") {
          const delta = typeof data?.delta === "string" ? data.delta : "";
          const text = typeof data?.text === "string" ? data.text : "";
          if (text) {
            setStreamText(text);
          } else if (delta) {
            setStreamText((prev) => (prev ?? "") + delta);
          }
          setIsStreaming(true);
          return;
        }

        if (stream === "lifecycle") {
          const phase = typeof data?.phase === "string" ? data.phase : "";
          if (phase === "end" || phase === "error") {
            setIsStreaming(false);
          }
        }
        return;
      }

      // ── runtime.chat events ──
      const state = typeof payload.state === "string" ? payload.state : "";
      const role = resolveRole(payload.message);

      if (state === "delta") {
        const text = extractText(payload.message);
        if (typeof text === "string") {
          setStreamText(text);
          setIsStreaming(true);
        }
        return;
      }

      if (state === "final") {
        const text = extractText(payload.message);
        if (role === "assistant" && typeof text === "string") {
          const finalText = text.trim();
          const wizardType = ctx.type;

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: finalText,
              wizardType,
              timestamp: Date.now(),
            },
          ]);
          setStreamText(null);
          setThinkingTrace(null);
          setIsStreaming(false);

          // Config extraction
          const extractor = createConfigExtractor(ctx.extractorType);
          const config = extractor(finalText);
          if (config) {
            const extracted: WizardExtractedConfig = {
              type: wizardType,
              config,
              sourceText: finalText,
            };
            setExtractedConfig(extracted);
            onConfigExtractedRef.current?.(extracted);
          }
        }
        return;
      }

      if (state === "error") {
        const errorMsg =
          typeof payload.errorMessage === "string"
            ? payload.errorMessage
            : "An error occurred in the wizard session.";
        setError(errorMsg);
        setStreamText(null);
        setThinkingTrace(null);
        setIsStreaming(false);
        return;
      }

      if (state === "aborted") {
        setStreamText(null);
        setThinkingTrace(null);
        setIsStreaming(false);
      }
    });

    return unsub;
  }, [client]);

  // ── Start wizard ───────────────────────────────────────────────────

  const startWizard = useCallback(
    (type: WizardType, systemPrompt: string) => {
      const sessionKey = `agent:${agentId}:wizard:${type}`;
      const theme = getWizardTheme(type);
      const starters = getWizardStarters(type);

      const ctx: WizardContext = {
        type,
        sessionKey,
        systemPrompt,
        extractorType: type,
        theme,
        starters,
        startedAt: Date.now(),
      };

      // Reset state for new wizard
      setWizardContext(ctx);
      setMessages([]);
      setStreamText(null);
      setThinkingTrace(null);
      setIsStreaming(false);
      setError(null);
      setExtractedConfig(null);
      sessionInitRef.current = false;
      cleanedUpRef.current = false;
    },
    [agentId],
  );

  // ── Send message ───────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const ctx = wizardContextRef.current;
      if (!ctx) {
        setError("No active wizard session.");
        return;
      }

      setError(null);

      try {
        // Send system prompt on first message
        if (!sessionInitRef.current) {
          sessionInitRef.current = true;
          try {
            await client.call("chat.send", {
              sessionKey: ctx.sessionKey,
              message: `[system] ${ctx.systemPrompt}`,
              deliver: false,
              idempotencyKey: crypto.randomUUID(),
            });
          } catch (err) {
            sessionInitRef.current = false;
            throw err;
          }
        }

        // Add user message to local state
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            wizardType: ctx.type,
            timestamp: Date.now(),
          },
        ]);
        setIsStreaming(true);

        await client.call("chat.send", {
          sessionKey: ctx.sessionKey,
          message: text,
          deliver: false,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send wizard message.");
        setIsStreaming(false);
      }
    },
    [client],
  );

  // ── Abort ──────────────────────────────────────────────────────────

  const abort = useCallback(async () => {
    const ctx = wizardContextRef.current;
    if (!ctx) return;
    try {
      await client.call("chat.abort", { sessionKey: ctx.sessionKey });
    } catch {
      // Ignore abort errors
    }
    setIsStreaming(false);
    setStreamText(null);
  }, [client]);

  // ── End wizard ─────────────────────────────────────────────────────

  const endWizard = useCallback(async () => {
    const ctx = wizardContextRef.current;
    if (!ctx) return;
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;

    // Clean up the isolated session
    try {
      await client.call("sessions.delete", { key: ctx.sessionKey });
    } catch {
      // Ignore cleanup errors — session may not exist
    }

    setWizardContext(null);
    setMessages([]);
    setStreamText(null);
    setThinkingTrace(null);
    setIsStreaming(false);
    setError(null);
    setExtractedConfig(null);
    sessionInitRef.current = false;
  }, [client]);

  return {
    wizardContext,
    messages,
    streamText,
    thinkingTrace,
    isStreaming,
    error,
    extractedConfig,
    startWizard,
    sendMessage,
    endWizard,
    abort,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function resolveRole(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const role = (message as Record<string, unknown>).role;
  return typeof role === "string" ? role : null;
}

function extractText(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;

  if (typeof msg.text === "string") return msg.text;
  if (typeof msg.content === "string") return msg.content;

  if (Array.isArray(msg.content)) {
    const texts = msg.content
      .filter(
        (part: unknown) =>
          part &&
          typeof part === "object" &&
          (part as Record<string, unknown>).type === "text",
      )
      .map((part: unknown) => (part as Record<string, unknown>).text)
      .filter((t): t is string => typeof t === "string");
    return texts.length > 0 ? texts.join("") : null;
  }

  return null;
}
