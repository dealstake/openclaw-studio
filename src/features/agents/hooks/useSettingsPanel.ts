import { useEffect, useMemo, useState } from "react";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { AgentState } from "@/features/agents/state/store";

type UseSettingsPanelParams = {
  status: GatewayStatus;
  agents: AgentState[];
};

export function useSettingsPanel({ status, agents }: UseSettingsPanelParams) {
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null);

  const settingsAgent = useMemo(
    () =>
      settingsAgentId
        ? (agents.find((entry) => entry.agentId === settingsAgentId) ?? null)
        : null,
    [settingsAgentId, agents],
  );

  // Auto-clear settings agent if it no longer exists or disconnected
  const settingsAgentExists = settingsAgent !== null;
  useEffect(() => {
    if (settingsAgentId && (!settingsAgentExists || status !== "connected")) {
      if (!settingsAgentExists) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale agent reference when agent is deleted
        setSettingsAgentId(null);
      }
    }
  }, [settingsAgentId, settingsAgentExists, status]);

  return {
    settingsAgentId,
    setSettingsAgentId,
    settingsAgent,
  };
}
