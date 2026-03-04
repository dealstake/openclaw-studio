"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, EventFrame } from "@/lib/gateway/GatewayClient";
import { syncGatewaySessionSettings } from "@/lib/gateway/GatewayClient";
import { estimateCostUsd } from "../lib/costEstimator";
import type { PlaygroundRequest, PlaygroundResponse, PlaygroundResult } from "../lib/types";
import { extractMessageText } from "../lib/messageTextExtractor";

/** Typed subset of gateway event payloads relevant to playground streaming. */
interface PlaygroundEventPayload {
  sessionKey?: string;
  stream?: string;
  state?: string;
  data?: {
    delta?: string;
    text?: string;
    phase?: string;
  };
  message?: {
    role?: string;
    text?: string;
    content?: string | Array<{ type?: string; text?: string }>;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
  };
  errorMessage?: string;
}

export interface UsePlaygroundOptions {
  client: GatewayClient;
  /** The agent whose session namespace is used for playground calls */
  agentId: string | null;
}

export interface UsePlaygroundReturn {
  /** Ordered list of run results (newest first) */
  results: PlaygroundResult[];
  /** Text currently streaming in */
  streamText: string | null;
  isStreaming: boolean;
  error: string | null;
  run: (req: PlaygroundRequest) => Promise<void>;
  abort: () => Promise<void>;
  clearResults: () => void;
}

const PLAYGROUND_SESSION_SUFFIX = "playground";

function buildSessionKey(agentId: string): string {
  return `agent:${agentId}:${PLAYGROUND_SESSION_SUFFIX}`;
}

export function usePlayground({
  client,
  agentId,
}: UsePlaygroundOptions): UsePlaygroundReturn {
  const [results, setResults] = useState<PlaygroundResult[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track in-flight request timing
  const runStartRef = useRef<number | null>(null);
  // Current active run id
  const activeRunIdRef = useRef<string | null>(null);
  // Accumulated streamed text (avoid closure-stale reads)
  const streamAccRef = useRef<string>("");
  // Track if a model patch has been sent for the current session
  const sessionModelRef = useRef<string | null>(null);
  // Track if system prompt has been sent for this run
  const systemSentRef = useRef<string | null>(null);

  // Subscribe to gateway events for the playground session
  useEffect(() => {
    if (!agentId) return;
    const sessionKey = buildSessionKey(agentId);

    const unsub = client.onEvent((event: EventFrame) => {
      const activeRunId = activeRunIdRef.current;
      if (!activeRunId) return;
      if (event.event !== "chat" && event.event !== "agent") return;

      const payload = event.payload as PlaygroundEventPayload | undefined;
      if (!payload || payload.sessionKey !== sessionKey) return;

      // ── runtime.agent events ──
      if (event.event === "agent") {
        const stream = payload.stream ?? "";
        const data = payload.data ?? null;

        if (stream === "assistant") {
          const delta = data?.delta ?? "";
          const text = data?.text ?? "";
          if (text) {
            streamAccRef.current = text;
            setStreamText(text);
          } else if (delta) {
            streamAccRef.current += delta;
            setStreamText(streamAccRef.current);
          }
          setIsStreaming(true);
          return;
        }

        if (stream === "lifecycle") {
          const phase = data?.phase ?? "";
          if (phase === "end" || phase === "error") {
            // Finalize from lifecycle end
            const finalText = streamAccRef.current;
            const latencyMs = runStartRef.current ? Date.now() - runStartRef.current : undefined;
            setResults((prev) => {
              const idx = prev.findIndex((r) => r.id === activeRunId);
              if (idx === -1) return prev;
              const updated = [...prev];
              const existing = updated[idx];
              const existingReq = existing.request;

              // Rough token estimate from text length if no usage event fired
              const tokensOut = Math.ceil(finalText.length / 4);
              const tokensIn = Math.ceil(
                (existingReq.systemPrompt.length + existingReq.userMessage.length) / 4
              );
              const estimatedCostUsd = estimateCostUsd(existingReq.model, tokensIn, tokensOut) ?? undefined;

              const response: PlaygroundResponse = {
                text: finalText,
                latencyMs,
                tokensIn,
                tokensOut,
                estimatedCostUsd,
              };
              updated[idx] = { ...existing, response };
              return updated;
            });
            setStreamText(null);
            setIsStreaming(false);
            streamAccRef.current = "";
            activeRunIdRef.current = null;
          }
        }
        return;
      }

      // ── runtime.chat events ──
      const state = payload.state ?? "";
      const message = payload.message;
      const role = message?.role ?? null;

      if (state === "delta") {
        const text = extractMessageText(message);
        if (text) {
          streamAccRef.current = text;
          setStreamText(text);
          setIsStreaming(true);
        }
        return;
      }

      if (state === "final" && role === "assistant") {
        const finalText = extractMessageText(message) ?? streamAccRef.current;
        const latencyMs = runStartRef.current ? Date.now() - runStartRef.current : undefined;

        const tokensIn = payload.usage?.inputTokens ?? payload.usage?.promptTokens;
        const tokensOut = payload.usage?.outputTokens ?? payload.usage?.completionTokens;

        setResults((prev) => {
          const idx = prev.findIndex((r) => r.id === activeRunId);
          if (idx === -1) return prev;
          const updated = [...prev];
          const existing = updated[idx];
          const existingReq = existing.request;

          const resolvedIn = tokensIn ?? Math.ceil((existingReq.systemPrompt.length + existingReq.userMessage.length) / 4);
          const resolvedOut = tokensOut ?? Math.ceil(finalText.trim().length / 4);
          const estimatedCostUsd = estimateCostUsd(existingReq.model, resolvedIn, resolvedOut) ?? undefined;

          const response: PlaygroundResponse = {
            text: finalText.trim(),
            tokensIn: resolvedIn,
            tokensOut: resolvedOut,
            latencyMs,
            estimatedCostUsd,
          };
          updated[idx] = { ...existing, response };
          return updated;
        });

        setStreamText(null);
        setIsStreaming(false);
        streamAccRef.current = "";
        activeRunIdRef.current = null;
        return;
      }

      if (state === "error") {
        const errorMsg = payload.errorMessage ?? "Playground run failed.";
        setResults((prev) => {
          const idx = prev.findIndex((r) => r.id === activeRunId);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], error: errorMsg };
          return updated;
        });
        setError(errorMsg);
        setStreamText(null);
        setIsStreaming(false);
        streamAccRef.current = "";
        activeRunIdRef.current = null;
      }

      if (state === "aborted") {
        setStreamText(null);
        setIsStreaming(false);
        streamAccRef.current = "";
        activeRunIdRef.current = null;
      }
    });

    return unsub;
  }, [client, agentId]);

  const run = useCallback(
    async (req: PlaygroundRequest) => {
      if (!agentId) {
        setError("No agent selected — playground requires an active agent.");
        return;
      }
      if (isStreaming) return;

      const sessionKey = buildSessionKey(agentId);
      const runId = crypto.randomUUID();
      activeRunIdRef.current = runId;
      streamAccRef.current = "";
      runStartRef.current = Date.now();

      // Optimistically add the pending result
      const pending: PlaygroundResult = {
        id: runId,
        request: req,
        response: null,
        error: null,
        startedAt: Date.now(),
      };
      setResults((prev) => [pending, ...prev]);
      setError(null);
      setIsStreaming(true);
      setStreamText("");

      try {
        // Patch model if it changed since last run
        if (sessionModelRef.current !== req.model) {
          await syncGatewaySessionSettings({
            client,
            sessionKey,
            model: req.model,
          });
          sessionModelRef.current = req.model;
          // Reset system prompt tracking when model changes
          systemSentRef.current = null;
        }

        // Send system prompt if it changed
        const systemCacheKey = `${req.model}::${req.systemPrompt}`;
        if (systemSentRef.current !== systemCacheKey && req.systemPrompt.trim()) {
          // Reset session so system prompt is applied cleanly
          await client.call("sessions.reset", { key: sessionKey }).catch(() => null);
          await client.call("chat.send", {
            sessionKey,
            message: `[system] ${req.systemPrompt}`,
            deliver: false,
            idempotencyKey: crypto.randomUUID(),
          });
          systemSentRef.current = systemCacheKey;
        }

        // Send user message
        await client.call("chat.send", {
          sessionKey,
          message: req.userMessage,
          deliver: false,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to send playground request.";
        setResults((prev) => {
          const idx = prev.findIndex((r) => r.id === runId);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], error: msg };
          return updated;
        });
        setError(msg);
        setIsStreaming(false);
        setStreamText(null);
        activeRunIdRef.current = null;
      }
    },
    [client, agentId, isStreaming]
  );

  const abort = useCallback(async () => {
    if (!agentId) return;
    try {
      await client.call("chat.abort", { sessionKey: buildSessionKey(agentId) });
    } catch {
      // Ignore abort errors
    }
    setIsStreaming(false);
    setStreamText(null);
    streamAccRef.current = "";
    activeRunIdRef.current = null;
  }, [client, agentId]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setStreamText(null);
    activeRunIdRef.current = null;
  }, []);

  return { results, streamText, isStreaming, error, run, abort, clearResults };
}


