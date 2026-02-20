import { useCallback, useEffect, useMemo, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { AgentState } from "@/features/agents/state/store";
import { useCronJobsPanel } from "./useCronJobsPanel";
import { useHeartbeatsPanel } from "./useHeartbeatsPanel";

type UseSettingsPanelParams = {
  client: GatewayClient;
  status: GatewayStatus;
  agents: AgentState[];
};

export function useSettingsPanel({ client, status, agents }: UseSettingsPanelParams) {
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null);

  const settingsAgent = useMemo(
    () =>
      settingsAgentId
        ? (agents.find((entry) => entry.agentId === settingsAgentId) ?? null)
        : null,
    [settingsAgentId, agents],
  );

  const cron = useCronJobsPanel({ client });
  const heartbeat = useHeartbeatsPanel({ client });

  // Reset settings panel state when agent is cleared or disconnected
  useEffect(() => {
    if (!settingsAgentId || status !== "connected") {
      cron.resetCron();
      heartbeat.resetHeartbeats();
      return;
    }
    void cron.loadCronRef.current(settingsAgentId);
    void heartbeat.loadHeartbeatsRef.current(settingsAgentId);
  }, [settingsAgentId, status]); // eslint-disable-line react-hooks/exhaustive-deps -- refs are stable

  // Auto-clear settings agent if it no longer exists
  const settingsAgentExists = settingsAgent !== null;
  useEffect(() => {
    if (settingsAgentId && !settingsAgentExists) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing: clears stale agent reference when agent is deleted
      setSettingsAgentId(null);
    }
  }, [settingsAgentId, settingsAgentExists]);

  const { loadCronJobs } = cron;
  const reloadCronJobs = useCallback(() => {
    if (settingsAgentId) {
      void loadCronJobs(settingsAgentId);
    }
  }, [settingsAgentId, loadCronJobs]);

  const { loadHeartbeats } = heartbeat;
  const reloadHeartbeats = useCallback(() => {
    if (settingsAgentId) {
      void loadHeartbeats(settingsAgentId);
    }
  }, [settingsAgentId, loadHeartbeats]);

  return {
    settingsAgentId,
    setSettingsAgentId,
    settingsAgent,
    // Cron — preserve original property names for backward compatibility
    settingsCronJobs: cron.cronJobs,
    settingsCronLoading: cron.cronLoading,
    settingsCronError: cron.cronError,
    cronRunBusyJobId: cron.cronRunBusyJobId,
    cronDeleteBusyJobId: cron.cronDeleteBusyJobId,
    handleRunCronJob: cron.handleRunCronJob,
    handleDeleteCronJob: cron.handleDeleteCronJob,
    cronToggleBusyJobId: cron.cronToggleBusyJobId,
    handleToggleCronJob: cron.handleToggleCronJob,
    reloadCronJobs,
    // Heartbeats — preserve original property names for backward compatibility
    settingsHeartbeats: heartbeat.heartbeats,
    settingsHeartbeatLoading: heartbeat.heartbeatLoading,
    settingsHeartbeatError: heartbeat.heartbeatError,
    heartbeatRunBusyId: heartbeat.heartbeatRunBusyId,
    heartbeatDeleteBusyId: heartbeat.heartbeatDeleteBusyId,
    handleRunHeartbeat: heartbeat.handleRunHeartbeat,
    handleDeleteHeartbeat: heartbeat.handleDeleteHeartbeat,
    reloadHeartbeats,
  };
}
