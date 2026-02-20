"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, EventFrame } from "@/lib/gateway/GatewayClient";
import type { MessagePart } from "@/lib/chat/types";

// ── Types ──────────────────────────────────────────────────────────────

export type WizardMessage = {
  role: "user" | "assistant";
  content: string;
  parts?: MessagePart[];
};

export type UseWizardSessionOptions = {
  client: GatewayClient;
  agentId: string;
  wizardType: "task" | "project" | "agent";
  systemPrompt: string;
  onConfigExtracted?: (config: unknown) => void;
  configExtractor?: (text: string) => unknown | null;
};

export type UseWizardSessionReturn = {
  messages: WizardMessage[];
  streamText: string | null;
  thinkingTrace: string | null;
  isStreaming: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  abort: () => Promise<void>;
  cleanup: () => Promise<void>;
};

// ── Hook ───────────────────────────────────────────────────────────────

export function useWizardSession({
  client,
  agentId,
  wizardType,
  systemPrompt,
  onConfigExtracted,
  configExtractor,
}: UseWizardSessionOptions): UseWizardSessionReturn {
  const [messages, setMessages] = useState<WizardMessage[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [thinkingTrace, setThinkingTrace] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionKeyRef = useRef(
    `agent:${agentId}:wizard:${wizardType}`
  );
  const sessionInitRef = useRef(false);
  const cleanedUpRef = useRef(false);
  const configExtractorRef = useRef(configExtractor);
  const onConfigExtractedRef = useRef(onConfigExtracted);

  // Keep refs current
  useEffect(() => {
    configExtractorRef.current = configExtractor;
  }, [configExtractor]);
  useEffect(() => {
    onConfigExtractedRef.current = onConfigExtracted;
  }, [onConfigExtracted]);

  // Subscribe to gateway events for this wizard session
  useEffect(() => {
    const sessionKey = sessionKeyRef.current;

    const unsub = client.onEvent((event: EventFrame) => {
      if (event.event !== "runtime.chat" && event.event !== "runtime.agent") return;

      const payload = event.payload as Record<string, unknown> | undefined;
      if (!payload) return;
      if (payload.sessionKey !== sessionKey) return;

      // ── runtime.agent events (thinking + tool streams) ──
      if (event.event === "runtime.agent") {
        const stream = typeof payload.stream === "string" ? payload.stream : "";
        const data = payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : null;

        // Reasoning/thinking stream
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

        // Assistant text stream from agent events
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

        // Lifecycle end
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
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: finalText },
          ]);
          setStreamText(null);
          setThinkingTrace(null);
          setIsStreaming(false);

          // Config extraction
          if (configExtractorRef.current && onConfigExtractedRef.current) {
            const config = configExtractorRef.current(finalText);
            if (config) {
              onConfigExtractedRef.current(config);
            }
          }
        }
        return;
      }

      if (state === "error") {
        const errorMsg = typeof payload.errorMessage === "string"
          ? payload.errorMessage
          : "An error occurred.";
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

  const sendMessage = useCallback(
    async (text: string) => {
      const sessionKey = sessionKeyRef.current;
      setError(null);

      try {
        // If session not yet initialized, send system prompt first
        if (!sessionInitRef.current) {
          sessionInitRef.current = true;
          await client.call("chat.send", {
            sessionKey,
            message: `[system] ${systemPrompt}`,
            deliver: false,
          });
          // Wait for system message to process, then send user message
        }

        // Add user message to local state
        setMessages((prev) => [...prev, { role: "user", content: text }]);
        setIsStreaming(true);

        await client.call("chat.send", {
          sessionKey,
          message: text,
          deliver: false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message.");
        setIsStreaming(false);
      }
    },
    [client, systemPrompt],
  );

  const abort = useCallback(async () => {
    try {
      await client.call("chat.abort", { sessionKey: sessionKeyRef.current });
    } catch {
      // Ignore abort errors
    }
    setIsStreaming(false);
    setStreamText(null);
  }, [client]);

  const cleanup = useCallback(async () => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    try {
      await client.call("sessions.delete", { key: sessionKeyRef.current });
    } catch {
      // Ignore cleanup errors — session may not exist
    }
  }, [client]);

  return {
    messages,
    streamText,
    thinkingTrace,
    isStreaming,
    error,
    sendMessage,
    abort,
    cleanup,
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

  // Direct text field
  if (typeof msg.text === "string") return msg.text;

  // Content as string
  if (typeof msg.content === "string") return msg.content;

  // Content as array (extract text parts)
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
