import { useCallback, useEffect, useRef } from "react";
import type { AgentState } from "../state/store";
import { buildHistorySyncPatch } from "../state/runtimeEventBridge";
import { type GatewayClient, isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";

type ChatHistoryResult = {
  sessionKey: string;
  sessionId?: string;
  messages: Record<string, unknown>[];
  thinkingLevel?: string;
};

type Dispatch = (action: { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }) => void;

export function useAgentHistorySync(params: {
  client: GatewayClient;
  dispatch: Dispatch;
  agents: AgentState[];
  stateRef: React.RefObject<{ agents: AgentState[] }>;
  status: string;
  focusedAgentId: string | null;
  focusedAgentRunning: boolean;
}) {
  const { client, dispatch, agents, stateRef, status, focusedAgentId, focusedAgentRunning } = params;
  const historyInFlightRef = useRef<Set<string>>(new Set());

  const loadAgentHistory = useCallback(
    async (agentId: string) => {
      const agent = stateRef.current.agents.find((entry) => entry.agentId === agentId);
      const sessionKey = agent?.sessionKey?.trim();
      if (!agent || !agent.sessionCreated || !sessionKey) return;
      if (historyInFlightRef.current.has(sessionKey)) return;

      historyInFlightRef.current.add(sessionKey);
      const loadedAt = Date.now();
      try {
        const result = await client.call<ChatHistoryResult>("chat.history", {
          sessionKey,
          limit: 200,
        });
        const patch = buildHistorySyncPatch({
          messages: result.messages ?? [],
          currentLines: agent.outputLines,
          loadedAt,
          status: agent.status,
          runId: agent.runId,
        });
        dispatch({
          type: "updateAgent",
          agentId,
          patch,
        });
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          const msg = err instanceof Error ? err.message : "Failed to load chat history.";
          console.error(msg);
        }
      } finally {
        historyInFlightRef.current.delete(sessionKey);
      }
    },
    [client, dispatch, stateRef]
  );

  // Stable ref avoids putting `loadAgentHistory` in useEffect deps below
  const loadAgentHistoryRef = useRef(loadAgentHistory);
  loadAgentHistoryRef.current = loadAgentHistory;

  // Load history for agents that don't have it yet.
  // Uses stateRef to read the latest agents list instead of putting `agents`
  // in the dep array (which changes identity on every state update and would
  // cause this effect to re-fire on every render during streaming).
  const agentsVersion = agents.length; // cheap primitive proxy — new agents added/removed
  useEffect(() => {
    if (status !== "connected") return;
    for (const agent of stateRef.current.agents) {
      if (!agent.sessionCreated || agent.historyLoadedAt) continue;
      void loadAgentHistoryRef.current(agent.agentId);
    }
  }, [agentsVersion, stateRef, status]);

  // Poll history for running focused agent — capped at 60 polls per run
  // to prevent unbounded RPC storms if status gets stuck as "running".
  const pollCountRef = useRef(0);
  const prevFocusedRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "connected") return;
    if (!focusedAgentId) return;
    if (!focusedAgentRunning) return;

    // Reset poll count when a new agent run starts
    const runKey = `${focusedAgentId}:running`;
    if (prevFocusedRunRef.current !== runKey) {
      prevFocusedRunRef.current = runKey;
      pollCountRef.current = 0;
    }

    void loadAgentHistoryRef.current(focusedAgentId);
    pollCountRef.current++;

    const timer = window.setInterval(() => {
      const latest = stateRef.current.agents.find((entry) => entry.agentId === focusedAgentId);
      if (!latest || latest.status !== "running") return;
      if (pollCountRef.current >= 60) return; // Cap: ~5 min at 5s intervals
      pollCountRef.current++;
      void loadAgentHistoryRef.current(focusedAgentId);
    }, 5000);
    return () => {
      window.clearInterval(timer);
    };
  }, [focusedAgentId, focusedAgentRunning, stateRef, status]);

  return {
    historyInFlightRef,
    loadAgentHistory,
  };
}
