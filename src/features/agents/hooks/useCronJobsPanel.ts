import { useMemo } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  type CronJobSummary,
  filterCronJobsForAgent,
  listCronJobs,
  removeCronJob,
  runCronJobNow,
  updateCronJob,
} from "@/lib/cron/types";
import { type UseResourcePanelConfig, useResourcePanel } from "./useResourcePanel";

const sortCronJobsByUpdatedAt = (jobs: CronJobSummary[]) =>
  [...jobs].sort((a, b) => b.updatedAtMs - a.updatedAtMs);

type UseCronJobsPanelParams = {
  client: GatewayClient;
};

export function useCronJobsPanel({ client }: UseCronJobsPanelParams) {
  const config = useMemo(
    (): UseResourcePanelConfig<CronJobSummary> => ({
      resourceLabel: "cron jobs",
      fetchItems: async (agentId) => {
        const result = await listCronJobs(client, { includeDisabled: true });
        return sortCronJobsByUpdatedAt(filterCronJobsForAgent(result.jobs, agentId));
      },
      runItem: async (_agentId, jobId) => {
        await runCronJobNow(client, jobId);
      },
      deleteItem: async (_agentId, jobId) => {
        const result = await removeCronJob(client, jobId);
        return !!(result.ok && result.removed);
      },
      toggleItem: async (_agentId, jobId, enabled) => {
        await updateCronJob(client, jobId, { enabled });
      },
    }),
    [client],
  );

  const panel = useResourcePanel(config);

  // Re-export with original names for backward compatibility
  return {
    cronJobs: panel.items,
    cronLoading: panel.loading,
    cronError: panel.error,
    cronRunBusyJobId: panel.runBusyId,
    cronDeleteBusyJobId: panel.deleteBusyId,
    cronToggleBusyJobId: panel.toggleBusyId,
    loadCronJobs: panel.load,
    loadCronRef: panel.loadRef,
    handleRunCronJob: panel.handleRun,
    handleDeleteCronJob: panel.handleDelete,
    handleToggleCronJob: panel.handleToggle,
    resetCron: panel.reset,
  };
}
