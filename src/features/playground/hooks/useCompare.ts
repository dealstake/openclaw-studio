"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, EventFrame } from "@/lib/gateway/GatewayClient";
import { syncGatewaySessionSettings } from "@/lib/gateway/GatewayClient";
import { estimateCostUsd } from "../lib/costEstimator";
import type { CompareColumnResult, CompareRun, PlaygroundResponse } from "../lib/types";

export interface UseCompareOptions {
  client: GatewayClient;
  agentId: string | null;
}

export interface UseCompareReturn {
  /** Latest compare run — null until first run */
  currentRun: CompareRun | null;
  isAnyStreaming: boolean;
  error: string | null;
  run: (models: string[], systemPrompt: string, userMessage: string) => Promise<void>;
  abort: () => Promise<void>;
  clear: () => void;
}

function buildCompareSessionKey(agentId: string, idx: number): string {
  return `agent:${agentId}:playground:cmp:${idx}`;
}

function makeEmptyColumn(model: string): CompareColumnResult {
  return { model, response: null, streamText: null, isStreaming: true, error: null };
}

export function useCompare({ client, agentId }: UseCompareOptions): UseCompareReturn {
  const [currentRun, setCurrentRun] = useState<CompareRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-session-index stream accumulators and timing
  const streamAccRef = useRef<Map<number, string>>(new Map());
  const runStartRef = useRef<number | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  // Track which session indices are still streaming
  const streamingRef = useRef<Set<number>>(new Set());
  // Model list for the active run (idx -> model key)
  const activeModelsRef = useRef<string[]>([]);
  // Rough estimate of prompt tokens shared across all columns
  const promptLengthRef = useRef<number>(0);

  // Finalize a column when its lifecycle ends — declared before useEffect to avoid hoisting issues
  const finalizeColumn = useCallback(
    (runId: string, colIdx: number, models: string[]) => {
      const finalText = streamAccRef.current.get(colIdx) ?? "";
      const latencyMs = runStartRef.current
        ? Date.now() - runStartRef.current
        : undefined;
      const model = models[colIdx] ?? "";
      const tokensOut = Math.ceil(finalText.length / 4);
      const tokensIn = Math.ceil(promptLengthRef.current / 4);
      const estimatedCostUsd =
        estimateCostUsd(model, tokensIn, tokensOut) ?? undefined;
      const response: PlaygroundResponse = {
        text: finalText,
        tokensIn,
        tokensOut,
        latencyMs,
        estimatedCostUsd,
      };
      streamingRef.current.delete(colIdx);
      setCurrentRun((prev) => {
        if (!prev || prev.id !== runId) return prev;
        return patchColumn(prev, colIdx, {
          response,
          streamText: null,
          isStreaming: false,
        });
      });
    },
    []
  );

  // ── Event subscriber ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!agentId) return;

    const unsub = client.onEvent((event: EventFrame) => {
      const runId = activeRunIdRef.current;
      if (!runId) return;
      if (event.event !== "runtime.chat" && event.event !== "runtime.agent") return;

      const payload = event.payload as Record<string, unknown> | undefined;
      if (!payload) return;

      const sessionKey =
        typeof payload.sessionKey === "string" ? payload.sessionKey :
        typeof payload.session === "string" ? payload.session : null;
      if (!sessionKey) return;

      // Which column index does this event belong to?
      const models = activeModelsRef.current;
      const colIdx = models.findIndex(
        (_, i) => buildCompareSessionKey(agentId, i) === sessionKey
      );
      if (colIdx === -1) return;

      // ── runtime.agent ──────────────────────────────────────────────────────
      if (event.event === "runtime.agent") {
        const stream = typeof payload.stream === "string" ? payload.stream : "";
        const data =
          payload.data && typeof payload.data === "object"
            ? (payload.data as Record<string, unknown>)
            : null;

        if (stream === "assistant") {
          const delta = typeof data?.delta === "string" ? data.delta : "";
          const text = typeof data?.text === "string" ? data.text : "";
          const acc = streamAccRef.current.get(colIdx) ?? "";
          const next = text || acc + delta;
          streamAccRef.current.set(colIdx, next);
          setCurrentRun((prev) =>
            prev ? patchColumn(prev, colIdx, { streamText: next, isStreaming: true }) : prev
          );
          return;
        }

        if (stream === "lifecycle") {
          const phase = typeof data?.phase === "string" ? data.phase : "";
          if (phase === "end" || phase === "error") {
            finalizeColumn(runId, colIdx, models);
          }
        }
        return;
      }

      // ── runtime.chat ───────────────────────────────────────────────────────
      const state = typeof payload.state === "string" ? payload.state : "";
      const message = payload.message as Record<string, unknown> | undefined;
      const role = message
        ? typeof message.role === "string"
          ? message.role
          : null
        : null;

      if (state === "delta") {
        const text = extractText(message);
        if (text) {
          streamAccRef.current.set(colIdx, text);
          setCurrentRun((prev) =>
            prev ? patchColumn(prev, colIdx, { streamText: text, isStreaming: true }) : prev
          );
        }
        return;
      }

      if (state === "final" && role === "assistant") {
        const finalText =
          extractText(message) ?? streamAccRef.current.get(colIdx) ?? "";
        const latencyMs = runStartRef.current
          ? Date.now() - runStartRef.current
          : undefined;
        const usage = payload.usage as Record<string, unknown> | undefined;
        const tokensIn =
          typeof usage?.inputTokens === "number" ? usage.inputTokens : undefined;
        const tokensOut =
          typeof usage?.outputTokens === "number" ? usage.outputTokens : undefined;
        const model = models[colIdx] ?? "";

        const resolvedIn = tokensIn ?? Math.ceil(promptLengthRef.current / 4);
        const resolvedOut = tokensOut ?? Math.ceil(finalText.length / 4);
        const estimatedCostUsd =
          estimateCostUsd(model, resolvedIn, resolvedOut) ?? undefined;

        const response: PlaygroundResponse = {
          text: finalText.trim(),
          tokensIn: resolvedIn,
          tokensOut: resolvedOut,
          latencyMs,
          estimatedCostUsd,
        };
        streamingRef.current.delete(colIdx);
        setCurrentRun((prev) =>
          prev
            ? patchColumn(prev, colIdx, {
                response,
                streamText: null,
                isStreaming: false,
              })
            : prev
        );
        return;
      }

      if (state === "error") {
        const errorMsg =
          typeof payload.errorMessage === "string"
            ? payload.errorMessage
            : "Model request failed.";
        streamingRef.current.delete(colIdx);
        setCurrentRun((prev) =>
          prev
            ? patchColumn(prev, colIdx, {
                error: errorMsg,
                isStreaming: false,
                streamText: null,
              })
            : prev
        );
        return;
      }

      if (state === "aborted") {
        streamingRef.current.delete(colIdx);
        setCurrentRun((prev) =>
          prev
            ? patchColumn(prev, colIdx, { isStreaming: false, streamText: null })
            : prev
        );
      }
    });

    return unsub;
  }, [client, agentId, finalizeColumn]);

  // ── run() ──────────────────────────────────────────────────────────────────
  const run = useCallback(
    async (models: string[], systemPrompt: string, userMessage: string) => {
      if (!agentId) {
        setError("No agent selected.");
        return;
      }
      if (!userMessage.trim()) return;

      const runId = crypto.randomUUID();
      activeRunIdRef.current = runId;
      activeModelsRef.current = models;
      streamAccRef.current = new Map();
      runStartRef.current = Date.now();
      promptLengthRef.current = systemPrompt.length + userMessage.length;
      streamingRef.current = new Set(models.map((_, i) => i));

      // Optimistic state
      const initialRun: CompareRun = {
        id: runId,
        systemPrompt,
        userMessage,
        columns: models.map(makeEmptyColumn),
        startedAt: Date.now(),
      };
      setCurrentRun(initialRun);
      setError(null);

      // Fire all sessions in parallel
      await Promise.all(
        models.map(async (model, idx) => {
          const sessionKey = buildCompareSessionKey(agentId, idx);
          try {
            await syncGatewaySessionSettings({ client, sessionKey, model });
            await client.call("sessions.reset", { key: sessionKey }).catch(() => null);
            if (systemPrompt.trim()) {
              await client.call("chat.send", {
                sessionKey,
                message: `[system] ${systemPrompt}`,
                deliver: false,
                idempotencyKey: crypto.randomUUID(),
              });
            }
            await client.call("chat.send", {
              sessionKey,
              message: userMessage.trim(),
              deliver: false,
              idempotencyKey: crypto.randomUUID(),
            });
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Failed to start request.";
            streamingRef.current.delete(idx);
            setCurrentRun((prev) =>
              prev
                ? patchColumn(prev, idx, { error: msg, isStreaming: false })
                : prev
            );
          }
        })
      );
    },
    [client, agentId]
  );

  // ── abort() ────────────────────────────────────────────────────────────────
  const abort = useCallback(async () => {
    if (!agentId) return;
    const models = activeModelsRef.current;
    await Promise.allSettled(
      models.map((_, idx) =>
        client.call("chat.abort", {
          sessionKey: buildCompareSessionKey(agentId, idx),
        })
      )
    );
    streamingRef.current.clear();
    setCurrentRun((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) =>
          col.isStreaming
            ? { ...col, isStreaming: false, streamText: null }
            : col
        ),
      };
    });
    activeRunIdRef.current = null;
  }, [client, agentId]);

  const clear = useCallback(() => {
    setCurrentRun(null);
    setError(null);
    activeRunIdRef.current = null;
    streamAccRef.current = new Map();
    streamingRef.current = new Set();
  }, []);

  const isAnyStreaming = currentRun?.columns.some((c) => c.isStreaming) ?? false;

  return { currentRun, isAnyStreaming, error, run, abort, clear };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function patchColumn(
  run: CompareRun,
  idx: number,
  patch: Partial<CompareColumnResult>
): CompareRun {
  const columns = [...run.columns];
  if (idx < 0 || idx >= columns.length) return run;
  columns[idx] = { ...columns[idx], ...patch };
  return { ...run, columns };
}

function extractText(
  message: Record<string, unknown> | undefined
): string | null {
  if (!message) return null;
  if (typeof message.text === "string") return message.text;
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    const texts = (message.content as unknown[])
      .filter(
        (p): p is Record<string, unknown> => !!p && typeof p === "object"
      )
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .filter((t): t is string => typeof t === "string");
    return texts.length > 0 ? texts.join("") : null;
  }
  return null;
}
