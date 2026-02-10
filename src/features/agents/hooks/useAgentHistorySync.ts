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

  // Load history for agents without it
  useEffect(() => {
    if (status !== "connected") return;
    for (const agent of agents) {
      if (!agent.sessionCreated || agent.historyLoadedAt) continue;
      void loadAgentHistory(agent.agentId);
    }
  }, [agents, loadAgentHistory, status]);

  // Poll history for running focused agent
  useEffect(() => {
    if (status !== "connected") return;
    if (!focusedAgentId) return;
    if (!focusedAgentRunning) return;
    void loadAgentHistory(focusedAgentId);
    const timer = window.setInterval(() => {
      const latest = stateRef.current.agents.find((entry) => entry.agentId === focusedAgentId);
      if (!latest || latest.status !== "running") return;
      void loadAgentHistory(focusedAgentId);
    }, 4500);
    return () => {
      window.clearInterval(timer);
    };
  }, [focusedAgentId, focusedAgentRunning, loadAgentHistory, stateRef, status]);

  return {
    historyInFlightRef,
    loadAgentHistory,
  };
}
