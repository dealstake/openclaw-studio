"use client";

import { useEffect, useRef, useCallback } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { LogLine, LogLineEvent } from "../lib/logTypes";
import { LOG_HISTORY_DEFAULT_LIMIT } from "../lib/logTypes";
import { normalizeLogLine } from "../lib/logParser";
import {
  appendLogLine,
  setLogLines,
  setLogStreamStatus,
} from "./useAgentLogStore";

// ---------------------------------------------------------------------------
// useAgentLogStream
//
// Manages the full log streaming lifecycle for a single agent:
//   1. On mount (when enabled): fetch history via logs.history RPC
//   2. Subscribe to log.line events from the gateway WebSocket
//   3. On unmount or agentId change: stop subscription, clean up
//
// Design notes:
//   - Uses useRef for the subscription ID to avoid stale-closure issues
//   - Registers an event listener on the GatewayClient rather than polling
//   - The gateway pushes log.line events when logs.stream.start is active
//   - Falls back gracefully when the gateway doesn't yet support the RPC
//     (treats RPC errors as "feature not available", status stays idle)
// ---------------------------------------------------------------------------

export interface UseAgentLogStreamOptions {
  /** The agent to stream logs for. Pass null/undefined to disable. */
  agentId: string | null | undefined;
  /** GatewayClient instance from useGateway(). */
  client: GatewayClient | null;
  /** Whether the log viewer is currently open/mounted. Streaming only runs when true. */
  enabled: boolean;
  /** Maximum historical lines to load on open. Defaults to LOG_HISTORY_DEFAULT_LIMIT. */
  historyLimit?: number;
}

export interface UseAgentLogStreamResult {
  /** Start a fresh stream (call after manual reconnect). */
  reconnect: () => void;
  /** Stop streaming and clear the subscription. */
  disconnect: () => void;
}

export function useAgentLogStream({
  agentId,
  client,
  enabled,
  historyLimit = LOG_HISTORY_DEFAULT_LIMIT,
}: UseAgentLogStreamOptions): UseAgentLogStreamResult {
  const subscriptionIdRef = useRef<string | null>(null);
  const activeAgentIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // --- Stop streaming helper ---
  const stopStream = useCallback(
    async (targetAgentId: string, subscriptionId: string | null) => {
      if (!subscriptionId || !client) return;
      try {
        await client.call<{ ok: true }>("logs.stream.stop", { subscriptionId });
      } catch {
        // Best-effort — gateway may have already cleaned up
      }
      subscriptionIdRef.current = null;
      setLogStreamStatus(targetAgentId, "idle", { subscriptionId: null });
    },
    [client],
  );

  // --- Start full lifecycle: history + stream ---
  const startStream = useCallback(
    async (targetAgentId: string) => {
      if (!client || !targetAgentId) return;

      activeAgentIdRef.current = targetAgentId;
      setLogStreamStatus(targetAgentId, "connecting");

      // 1. Fetch history
      try {
        const result = await client.call<{ agentId: string; lines: LogLine[] }>(
          "logs.history",
          { agentId: targetAgentId, limit: historyLimit },
        );
        if (!mountedRef.current || activeAgentIdRef.current !== targetAgentId) return;
        setLogLines(targetAgentId, result.lines ?? []);
      } catch {
        // History RPC may not be implemented yet — not a fatal error
        if (!mountedRef.current || activeAgentIdRef.current !== targetAgentId) return;
      }

      // 2. Start live stream subscription
      try {
        const result = await client.call<{ ok: true; subscriptionId: string }>(
          "logs.stream.start",
          { agentId: targetAgentId },
        );
        if (!mountedRef.current || activeAgentIdRef.current !== targetAgentId) return;
        subscriptionIdRef.current = result.subscriptionId;
        setLogStreamStatus(targetAgentId, "streaming", {
          subscriptionId: result.subscriptionId,
        });
      } catch {
        // Gateway doesn't support logs.stream yet — stay idle
        if (!mountedRef.current || activeAgentIdRef.current !== targetAgentId) return;
        setLogStreamStatus(targetAgentId, "idle", { subscriptionId: null });
      }
    },
    [client, historyLimit],
  );

  // --- Handle incoming log.line gateway events ---
  useEffect(() => {
    if (!client || !enabled) return;

    const unsub = client.onEvent((event) => {
      if (event.event !== "log.line") return;
      const payload = event.payload as LogLineEvent | undefined;
      if (!payload?.agentId || !payload.line) return;
      // Only process events for the currently active agent
      if (payload.agentId !== activeAgentIdRef.current) return;

      // Lines from gateway are already structured; normalize ensures text+level
      const normalized = {
        ...payload.line,
        text: payload.line.text || normalizeLogLine(payload.line.raw, payload.line.source).text,
      };
      appendLogLine(payload.agentId, normalized);
    });

    return unsub;
  }, [client, enabled]);

  // --- Start / stop stream when agentId or enabled changes ---
  useEffect(() => {
    mountedRef.current = true;

    if (!enabled || !agentId || !client) {
      // Stop any existing stream
      const prevId = activeAgentIdRef.current;
      const prevSub = subscriptionIdRef.current;
      if (prevId && prevSub) {
        void stopStream(prevId, prevSub);
      }
      activeAgentIdRef.current = null;
      return;
    }

    // Stop previous agent's stream if switching
    const prevId = activeAgentIdRef.current;
    const prevSub = subscriptionIdRef.current;
    if (prevId && prevId !== agentId && prevSub) {
      void stopStream(prevId, prevSub);
    }

    void startStream(agentId);

    return () => {
      mountedRef.current = false;
      const currentId = activeAgentIdRef.current;
      const currentSub = subscriptionIdRef.current;
      if (currentId && currentSub) {
        void stopStream(currentId, currentSub);
      }
      activeAgentIdRef.current = null;
    };
  }, [agentId, enabled, client, startStream, stopStream]);

  const reconnect = useCallback(() => {
    const id = agentId;
    if (!id || !enabled) return;
    const prevSub = subscriptionIdRef.current;
    if (prevSub) {
      void stopStream(id, prevSub);
    }
    void startStream(id);
  }, [agentId, enabled, startStream, stopStream]);

  const disconnect = useCallback(() => {
    const id = activeAgentIdRef.current;
    const sub = subscriptionIdRef.current;
    if (id && sub) {
      void stopStream(id, sub);
    }
    activeAgentIdRef.current = null;
  }, [stopStream]);

  return { reconnect, disconnect };
}
