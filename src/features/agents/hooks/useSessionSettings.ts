import { useCallback, type MutableRefObject } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { applySessionSettingMutation } from "@/features/agents/state/sessionSettingsMutations";
import type { Action, AgentState } from "@/features/agents/state/store";
import { setAgentAutonomyLevel, type AutonomyLevel } from "@/features/agents/lib/autonomyService";

interface UseSessionSettingsParams {
  client: GatewayClient;
  dispatch: React.Dispatch<Action>;
  stateRef: MutableRefObject<{ agents: AgentState[] }>;
}

export function useSessionSettings({
  client,
  dispatch,
  stateRef,
}: UseSessionSettingsParams) {
  const handleSessionSettingChange = useCallback(
    async (
      agentId: string,
      sessionKey: string,
      field: "model" | "thinkingLevel",
      value: string | null
    ) => {
      await applySessionSettingMutation({
        agents: stateRef.current.agents,
        dispatch,
        client,
        agentId,
        sessionKey,
        field,
        value,
      });
    },
    [client, dispatch, stateRef]
  );

  const handleModelChange = useCallback(
    async (agentId: string, sessionKey: string, value: string | null) => {
      await handleSessionSettingChange(agentId, sessionKey, "model", value);
    },
    [handleSessionSettingChange]
  );

  const handleThinkingChange = useCallback(
    async (agentId: string, sessionKey: string, value: string | null) => {
      await handleSessionSettingChange(agentId, sessionKey, "thinkingLevel", value);
    },
    [handleSessionSettingChange]
  );

  const handleToolCallingToggle = useCallback(
    (agentId: string, enabled: boolean) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { toolCallingEnabled: enabled },
      });
    },
    [dispatch]
  );

  const handleThinkingTracesToggle = useCallback(
    (agentId: string, enabled: boolean) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { showThinkingTraces: enabled },
      });
    },
    [dispatch]
  );

  const handleAutonomyChange = useCallback(
    async (agentId: string, level: AutonomyLevel) => {
      // Optimistic local update
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { autonomyLevel: level },
      });
      // Persist to gateway config
      try {
        await setAgentAutonomyLevel(client, agentId, level);
      } catch (err) {
        console.error("Failed to persist autonomy level:", err);
      }
    },
    [client, dispatch]
  );

  return {
    handleSessionSettingChange,
    handleModelChange,
    handleThinkingChange,
    handleToolCallingToggle,
    handleThinkingTracesToggle,
    handleAutonomyChange,
  };
}
