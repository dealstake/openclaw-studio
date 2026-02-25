import { useCallback, type MutableRefObject } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { buildNewSessionAgentPatch, type Action, type AgentState } from "@/features/agents/state/store";
import type { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";

type MobilePane = "chat" | "context";

interface UseNewSessionParams {
  client: GatewayClient;
  dispatch: React.Dispatch<Action>;
  stateRef: MutableRefObject<{ agents: AgentState[] }>;
  runtimeEventHandlerRef: MutableRefObject<ReturnType<typeof createGatewayRuntimeEventHandler> | null>;
  historyInFlightRef: MutableRefObject<Set<string>>;
  specialUpdateRef: MutableRefObject<Map<string, string>>;
  specialUpdateInFlightRef: MutableRefObject<Set<string>>;
  setError: (error: string | null) => void;
  setSettingsAgentId: (id: string | null) => void;
  setMobilePane: (pane: MobilePane) => void;
}

export function useNewSession({
  client,
  dispatch,
  stateRef,
  runtimeEventHandlerRef,
  historyInFlightRef,
  specialUpdateRef,
  specialUpdateInFlightRef,
  setError,
  setSettingsAgentId,
  setMobilePane,
}: UseNewSessionParams) {
  return useCallback(
    async (agentId: string) => {
      const agent = stateRef.current.agents.find((entry) => entry.agentId === agentId);
      if (!agent) {
        setError("Failed to start new session: agent not found.");
        return;
      }
      try {
        const sessionKey = agent.sessionKey.trim();
        if (!sessionKey) {
          throw new Error("Missing session key for agent.");
        }
        await client.call("sessions.reset", { key: sessionKey });
        const patch = buildNewSessionAgentPatch(agent);
        runtimeEventHandlerRef.current?.clearRunTracking(agent.runId);
        historyInFlightRef.current.delete(sessionKey);
        specialUpdateRef.current.delete(agentId);
        specialUpdateInFlightRef.current.delete(agentId);
        dispatch({
          type: "updateAgent",
          agentId,
          patch,
        });
        setSettingsAgentId(null);
        setMobilePane("chat");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start new session.";
        setError(message);
        dispatch({
          type: "appendPart",
          agentId,
          part: { type: "text", text: `New session failed: ${message}` },
        });
      }
    },
    [client, dispatch, historyInFlightRef, runtimeEventHandlerRef, setError, setSettingsAgentId, setMobilePane, specialUpdateInFlightRef, specialUpdateRef, stateRef]
  );
}
