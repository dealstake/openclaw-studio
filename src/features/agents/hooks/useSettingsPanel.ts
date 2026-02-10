import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError, type GatewayStatus } from "@/lib/gateway/GatewayClient";
import {
  type CronJobSummary,
  filterCronJobsForAgent,
  listCronJobs,
  removeCronJob,
  runCronJobNow,
} from "@/lib/cron/types";
import {
  removeGatewayHeartbeatOverride,
  listHeartbeatsForAgent,
  triggerHeartbeatNow,
  type AgentHeartbeatSummary,
} from "@/lib/gateway/agentConfig";
import type { AgentState } from "@/features/agents/state/store";

const sortCronJobsByUpdatedAt = (jobs: CronJobSummary[]) =>
  [...jobs].sort((a, b) => b.updatedAtMs - a.updatedAtMs);

type UseSettingsPanelParams = {
  client: GatewayClient;
  status: GatewayStatus;
  agents: AgentState[];
};

export function useSettingsPanel({ client, status, agents }: UseSettingsPanelParams) {
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null);
  const [settingsCronJobs, setSettingsCronJobs] = useState<CronJobSummary[]>([]);
  const [settingsCronLoading, setSettingsCronLoading] = useState(false);
  const [settingsCronError, setSettingsCronError] = useState<string | null>(null);
  const [cronRunBusyJobId, setCronRunBusyJobId] = useState<string | null>(null);
  const [cronDeleteBusyJobId, setCronDeleteBusyJobId] = useState<string | null>(null);
  const [settingsHeartbeats, setSettingsHeartbeats] = useState<AgentHeartbeatSummary[]>([]);
  const [settingsHeartbeatLoading, setSettingsHeartbeatLoading] = useState(false);
  const [settingsHeartbeatError, setSettingsHeartbeatError] = useState<string | null>(null);
  const [heartbeatRunBusyId, setHeartbeatRunBusyId] = useState<string | null>(null);
  const [heartbeatDeleteBusyId, setHeartbeatDeleteBusyId] = useState<string | null>(null);

  const settingsAgent = settingsAgentId
    ? (agents.find((entry) => entry.agentId === settingsAgentId) ?? null)
    : null;

  const loadCronJobsForSettingsAgent = useCallback(
    async (agentId: string) => {
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId) {
        setSettingsCronJobs([]);
        setSettingsCronError("Failed to load cron jobs: missing agent id.");
        return;
      }
      setSettingsCronLoading(true);
      setSettingsCronError(null);
      try {
        const result = await listCronJobs(client, { includeDisabled: true });
        const filtered = filterCronJobsForAgent(result.jobs, resolvedAgentId);
        setSettingsCronJobs(sortCronJobsByUpdatedAt(filtered));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load cron jobs.";
        setSettingsCronJobs([]);
        setSettingsCronError(message);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
      } finally {
        setSettingsCronLoading(false);
      }
    },
    [client]
  );

  const loadHeartbeatsForSettingsAgent = useCallback(
    async (agentId: string) => {
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId) {
        setSettingsHeartbeats([]);
        setSettingsHeartbeatError("Failed to load heartbeats: missing agent id.");
        return;
      }
      setSettingsHeartbeatLoading(true);
      setSettingsHeartbeatError(null);
      try {
        const result = await listHeartbeatsForAgent(client, resolvedAgentId);
        setSettingsHeartbeats(result.heartbeats);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load heartbeats.";
        setSettingsHeartbeats([]);
        setSettingsHeartbeatError(message);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
      } finally {
        setSettingsHeartbeatLoading(false);
      }
    },
    [client]
  );

  // Stable refs to avoid useEffect dep cascade when `client` identity changes
  const loadCronRef = useRef(loadCronJobsForSettingsAgent);
  loadCronRef.current = loadCronJobsForSettingsAgent;
  const loadHeartbeatsRef = useRef(loadHeartbeatsForSettingsAgent);
  loadHeartbeatsRef.current = loadHeartbeatsForSettingsAgent;

  // Reset settings panel state when agent is cleared or disconnected
  useEffect(() => {
    if (!settingsAgentId || status !== "connected") {
      setSettingsCronJobs([]);
      setSettingsCronLoading(false);
      setSettingsCronError(null);
      setCronRunBusyJobId(null);
      setCronDeleteBusyJobId(null);
      setSettingsHeartbeats([]);
      setSettingsHeartbeatLoading(false);
      setSettingsHeartbeatError(null);
      setHeartbeatRunBusyId(null);
      setHeartbeatDeleteBusyId(null);
      return;
    }
    void loadCronRef.current(settingsAgentId);
    void loadHeartbeatsRef.current(settingsAgentId);
  }, [settingsAgentId, status]);

  // Auto-clear settings agent if it no longer exists
  useEffect(() => {
    if (settingsAgentId && !settingsAgent) {
      setSettingsAgentId(null);
    }
  }, [settingsAgentId, settingsAgent]);

  const handleRunCronJob = useCallback(
    async (agentId: string, jobId: string) => {
      const resolvedJobId = jobId.trim();
      const resolvedAgentId = agentId.trim();
      if (!resolvedJobId || !resolvedAgentId) return;
      if (cronRunBusyJobId || cronDeleteBusyJobId) return;
      setCronRunBusyJobId(resolvedJobId);
      setSettingsCronError(null);
      try {
        await runCronJobNow(client, resolvedJobId);
        await loadCronJobsForSettingsAgent(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to run cron job.";
        setSettingsCronError(message);
        console.error(message);
      } finally {
        setCronRunBusyJobId((current) => (current === resolvedJobId ? null : current));
      }
    },
    [client, cronDeleteBusyJobId, cronRunBusyJobId, loadCronJobsForSettingsAgent]
  );

  const handleDeleteCronJob = useCallback(
    async (agentId: string, jobId: string) => {
      const resolvedJobId = jobId.trim();
      const resolvedAgentId = agentId.trim();
      if (!resolvedJobId || !resolvedAgentId) return;
      if (cronRunBusyJobId || cronDeleteBusyJobId) return;
      setCronDeleteBusyJobId(resolvedJobId);
      setSettingsCronError(null);
      try {
        const result = await removeCronJob(client, resolvedJobId);
        if (result.ok && result.removed) {
          setSettingsCronJobs((jobs) => jobs.filter((job) => job.id !== resolvedJobId));
        }
        await loadCronJobsForSettingsAgent(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete cron job.";
        setSettingsCronError(message);
        console.error(message);
      } finally {
        setCronDeleteBusyJobId((current) => (current === resolvedJobId ? null : current));
      }
    },
    [client, cronDeleteBusyJobId, cronRunBusyJobId, loadCronJobsForSettingsAgent]
  );

  const handleRunHeartbeat = useCallback(
    async (agentId: string, heartbeatId: string) => {
      const resolvedAgentId = agentId.trim();
      const resolvedHeartbeatId = heartbeatId.trim();
      if (!resolvedAgentId || !resolvedHeartbeatId) return;
      if (heartbeatRunBusyId || heartbeatDeleteBusyId) return;
      setHeartbeatRunBusyId(resolvedHeartbeatId);
      setSettingsHeartbeatError(null);
      try {
        await triggerHeartbeatNow(client, resolvedAgentId);
        await loadHeartbeatsForSettingsAgent(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to trigger heartbeat.";
        setSettingsHeartbeatError(message);
        console.error(message);
      } finally {
        setHeartbeatRunBusyId((current) =>
          current === resolvedHeartbeatId ? null : current
        );
      }
    },
    [client, heartbeatDeleteBusyId, heartbeatRunBusyId, loadHeartbeatsForSettingsAgent]
  );

  const handleDeleteHeartbeat = useCallback(
    async (agentId: string, heartbeatId: string) => {
      const resolvedAgentId = agentId.trim();
      const resolvedHeartbeatId = heartbeatId.trim();
      if (!resolvedAgentId || !resolvedHeartbeatId) return;
      if (heartbeatRunBusyId || heartbeatDeleteBusyId) return;
      setHeartbeatDeleteBusyId(resolvedHeartbeatId);
      setSettingsHeartbeatError(null);
      try {
        await removeGatewayHeartbeatOverride({
          client,
          agentId: resolvedAgentId,
        });
        setSettingsHeartbeats((heartbeats) =>
          heartbeats.filter((heartbeat) => heartbeat.id !== resolvedHeartbeatId)
        );
        await loadHeartbeatsForSettingsAgent(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete heartbeat.";
        setSettingsHeartbeatError(message);
        console.error(message);
      } finally {
        setHeartbeatDeleteBusyId((current) =>
          current === resolvedHeartbeatId ? null : current
        );
      }
    },
    [client, heartbeatDeleteBusyId, heartbeatRunBusyId, loadHeartbeatsForSettingsAgent]
  );

  return {
    settingsAgentId,
    setSettingsAgentId,
    settingsAgent,
    settingsCronJobs,
    settingsCronLoading,
    settingsCronError,
    cronRunBusyJobId,
    cronDeleteBusyJobId,
    settingsHeartbeats,
    settingsHeartbeatLoading,
    settingsHeartbeatError,
    heartbeatRunBusyId,
    heartbeatDeleteBusyId,
    handleRunCronJob,
    handleDeleteCronJob,
    handleRunHeartbeat,
    handleDeleteHeartbeat,
  };
}
