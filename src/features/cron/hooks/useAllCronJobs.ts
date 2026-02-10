import { useCallback, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import {
  type CronJobSummary,
  listCronJobs,
  removeCronJob,
  runCronJobNow,
} from "@/lib/cron/types";

const sortCronJobsByUpdatedAt = (jobs: CronJobSummary[]) =>
  [...jobs].sort((a, b) => b.updatedAtMs - a.updatedAtMs);

export const useAllCronJobs = (client: GatewayClient, status: GatewayStatus) => {
  const [allCronJobs, setAllCronJobs] = useState<CronJobSummary[]>([]);
  const [allCronLoading, setAllCronLoading] = useState(false);
  const [allCronError, setAllCronError] = useState<string | null>(null);
  const [allCronRunBusyJobId, setAllCronRunBusyJobId] = useState<string | null>(null);
  const [allCronDeleteBusyJobId, setAllCronDeleteBusyJobId] = useState<string | null>(null);

  const loadAllCronJobs = useCallback(async () => {
    if (status !== "connected") return;
    setAllCronLoading(true);
    try {
      const result = await listCronJobs(client, { includeDisabled: true });
      setAllCronJobs(sortCronJobsByUpdatedAt(result.jobs));
      setAllCronError(null);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message = err instanceof Error ? err.message : "Failed to load cron jobs.";
        setAllCronError(message);
      }
    } finally {
      setAllCronLoading(false);
    }
  }, [client, status]);

  const handleAllCronRunJob = useCallback(
    async (jobId: string) => {
      if (allCronRunBusyJobId || allCronDeleteBusyJobId) return;
      setAllCronRunBusyJobId(jobId);
      setAllCronError(null);
      try {
        await runCronJobNow(client, jobId);
        await loadAllCronJobs();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to run cron job.";
        setAllCronError(message);
      } finally {
        setAllCronRunBusyJobId(null);
      }
    },
    [client, allCronRunBusyJobId, allCronDeleteBusyJobId, loadAllCronJobs]
  );

  const handleAllCronDeleteJob = useCallback(
    async (jobId: string) => {
      if (allCronRunBusyJobId || allCronDeleteBusyJobId) return;
      setAllCronDeleteBusyJobId(jobId);
      setAllCronError(null);
      try {
        await removeCronJob(client, jobId);
        setAllCronJobs((jobs) => jobs.filter((j) => j.id !== jobId));
        await loadAllCronJobs();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete cron job.";
        setAllCronError(message);
      } finally {
        setAllCronDeleteBusyJobId(null);
      }
    },
    [client, allCronRunBusyJobId, allCronDeleteBusyJobId, loadAllCronJobs]
  );

  return {
    allCronJobs,
    allCronLoading,
    allCronError,
    allCronRunBusyJobId,
    allCronDeleteBusyJobId,
    loadAllCronJobs,
    handleAllCronRunJob,
    handleAllCronDeleteJob,
  };
};
