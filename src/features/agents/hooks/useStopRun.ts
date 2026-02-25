import { useCallback } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { Action } from "@/features/agents/state/store";

interface UseStopRunParams {
  client: GatewayClient;
  status: string;
  dispatch: React.Dispatch<Action>;
  setError: (error: string | null) => void;
  stopBusyAgentId: string | null;
  setStopBusyAgentId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useStopRun({
  client,
  status,
  dispatch,
  setError,
  stopBusyAgentId,
  setStopBusyAgentId,
}: UseStopRunParams) {
  return useCallback(
    async (agentId: string, sessionKey: string) => {
      if (status !== "connected") {
        setError("Connect to gateway before stopping a run.");
        return;
      }
      const resolvedSessionKey = sessionKey.trim();
      if (!resolvedSessionKey) {
        setError("Missing session key for agent.");
        return;
      }
      if (stopBusyAgentId === agentId) {
        return;
      }
      setStopBusyAgentId(agentId);
      try {
        await client.call("chat.abort", {
          sessionKey: resolvedSessionKey,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to stop run.";
        setError(message);
        console.error(message);
        dispatch({
          type: "appendPart",
          agentId,
          part: { type: "text", text: `Stop failed: ${message}` },
        });
      } finally {
        setStopBusyAgentId((current) => (current === agentId ? null : current));
      }
    },
    [client, dispatch, setError, setStopBusyAgentId, status, stopBusyAgentId]
  );
}
