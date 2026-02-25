import { useCallback, useRef, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import {
  type CronJobSummary,
  filterCronJobsForAgent,
  listCronJobs,
  removeCronJob,
  runCronJobNow,
  updateCronJob,
} from "@/lib/cron/types";

const sortCronJobsByUpdatedAt = (jobs: CronJobSummary[]) =>
  [...jobs].sort((a, b) => b.updatedAtMs - a.updatedAtMs);

type UseCronJobsPanelParams = {
  client: GatewayClient;
};

export function useCronJobsPanel({ client }: UseCronJobsPanelParams) {
  const [cronJobs, setCronJobs] = useState<CronJobSummary[]>([]);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronError, setCronError] = useState<string | null>(null);
  const [cronRunBusyJobId, setCronRunBusyJobId] = useState<string | null>(null);
  const [cronDeleteBusyJobId, setCronDeleteBusyJobId] = useState<string | null>(null);
  const [cronToggleBusyJobId, setCronToggleBusyJobId] = useState<string | null>(null);

  const loadCronJobs = useCallback(
    async (agentId: string) => {
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId) {
        setCronJobs([]);
        setCronError("Failed to load cron jobs: missing agent id.");
        return;
      }
      setCronLoading(true);
      setCronError(null);
      try {
        const result = await listCronJobs(client, { includeDisabled: true });
        const filtered = filterCronJobsForAgent(result.jobs, resolvedAgentId);
        setCronJobs(sortCronJobsByUpdatedAt(filtered));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load cron jobs.";
        setCronJobs([]);
        setCronError(message);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
      } finally {
        setCronLoading(false);
      }
    },
    [client],
  );

  const loadCronRef = useRef(loadCronJobs);
  loadCronRef.current = loadCronJobs;

  const handleRunCronJob = useCallback(
    async (agentId: string, jobId: string) => {
      const resolvedJobId = jobId.trim();
      const resolvedAgentId = agentId.trim();
      if (!resolvedJobId || !resolvedAgentId) return;
      if (cronRunBusyJobId || cronDeleteBusyJobId) return;
      setCronRunBusyJobId(resolvedJobId);
      setCronError(null);
      try {
        await runCronJobNow(client, resolvedJobId);
        await loadCronJobs(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to run cron job.";
        setCronError(message);
        console.error(message);
      } finally {
        setCronRunBusyJobId((current) => (current === resolvedJobId ? null : current));
      }
    },
    [client, cronDeleteBusyJobId, cronRunBusyJobId, loadCronJobs],
  );

  const handleDeleteCronJob = useCallback(
    async (agentId: string, jobId: string) => {
      const resolvedJobId = jobId.trim();
      const resolvedAgentId = agentId.trim();
      if (!resolvedJobId || !resolvedAgentId) return;
      if (cronRunBusyJobId || cronDeleteBusyJobId) return;
      setCronDeleteBusyJobId(resolvedJobId);
      setCronError(null);
      try {
        const result = await removeCronJob(client, resolvedJobId);
        if (result.ok && result.removed) {
          setCronJobs((jobs) => jobs.filter((job) => job.id !== resolvedJobId));
        }
        await loadCronJobs(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete cron job.";
        setCronError(message);
        console.error(message);
      } finally {
        setCronDeleteBusyJobId((current) => (current === resolvedJobId ? null : current));
      }
    },
    [client, cronDeleteBusyJobId, cronRunBusyJobId, loadCronJobs],
  );

  const handleToggleCronJob = useCallback(
    async (agentId: string, jobId: string, enabled: boolean) => {
      const resolvedJobId = jobId.trim();
      const resolvedAgentId = agentId.trim();
      if (!resolvedJobId || !resolvedAgentId) return;
      if (cronToggleBusyJobId) return;
      setCronToggleBusyJobId(resolvedJobId);
      setCronError(null);
      try {
        await updateCronJob(client, resolvedJobId, { enabled });
        await loadCronJobs(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to toggle cron job.";
        setCronError(message);
        console.error(message);
      } finally {
        setCronToggleBusyJobId((current) => (current === resolvedJobId ? null : current));
      }
    },
    [client, cronToggleBusyJobId, loadCronJobs],
  );

  const resetCron = useCallback(() => {
    setCronJobs([]);
    setCronLoading(false);
    setCronError(null);
    setCronRunBusyJobId(null);
    setCronDeleteBusyJobId(null);
    setCronToggleBusyJobId(null);
  }, []);

  return {
    cronJobs,
    cronLoading,
    cronError,
    cronRunBusyJobId,
    cronDeleteBusyJobId,
    loadCronJobs,
    loadCronRef,
    handleRunCronJob,
    handleDeleteCronJob,
    cronToggleBusyJobId,
    handleToggleCronJob,
    resetCron,
  };
}
