/**
 * Cron job gateway API calls.
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { resolveRequiredId } from "@/lib/validation";
import type {
  CronJobsResult,
  CronListParams,
  CronRunResult,
  CronRemoveResult,
  CronAddParams,
  CronAddResult,
  CronUpdateParams,
  CronUpdateResult,
  CronRunEntry,
  CronRunsResult,
} from "./cron-types";

const resolveJobId = (jobId: string) => resolveRequiredId(jobId, "Cron job id");
const resolveAgentId = (agentId: string) => resolveRequiredId(agentId, "Agent id");

export const listCronJobs = async (
  client: GatewayClient,
  params: CronListParams = {}
): Promise<CronJobsResult> => {
  const includeDisabled = params.includeDisabled ?? true;
  return client.call<CronJobsResult>("cron.list", {
    includeDisabled,
  });
};

export const runCronJobNow = async (client: GatewayClient, jobId: string): Promise<CronRunResult> => {
  const id = resolveJobId(jobId);
  return client.call<CronRunResult>("cron.run", {
    id,
    mode: "force",
  });
};

export const removeCronJob = async (
  client: GatewayClient,
  jobId: string
): Promise<CronRemoveResult> => {
  const id = resolveJobId(jobId);
  return client.call<CronRemoveResult>("cron.remove", {
    id,
  });
};

/** Gateway returns the full job object on success, or {ok:false} on error. */
export const addCronJob = async (
  client: GatewayClient,
  params: CronAddParams
): Promise<CronAddResult> => {
  const raw = await client.call<Record<string, unknown>>("cron.add", { job: params });
  if (raw && typeof raw === "object" && "id" in raw && typeof raw.id === "string") {
    return { ok: true, jobId: raw.id };
  }
  if (raw && typeof raw === "object" && "ok" in raw) {
    return raw as CronAddResult;
  }
  return { ok: false };
};

export const updateCronJob = async (
  client: GatewayClient,
  jobId: string,
  patch: CronUpdateParams
): Promise<CronUpdateResult> => {
  const id = resolveJobId(jobId);
  return client.call<CronUpdateResult>("cron.update", { jobId: id, patch });
};

export const fetchCronRuns = async (
  client: GatewayClient,
  jobId: string,
  limit = 20
): Promise<CronRunEntry[]> => {
  const result = await client.call<CronRunsResult>("cron.runs", {
    jobId,
    limit,
  });
  return result.runs ?? [];
};

export const removeCronJobsForAgent = async (client: GatewayClient, agentId: string): Promise<number> => {
  const id = resolveAgentId(agentId);
  const result = await listCronJobs(client, { includeDisabled: true });
  const jobs = result.jobs.filter((job) => job.agentId?.trim() === id);
  const results = await Promise.all(
    jobs.map(async (job) => {
      const removeResult = await removeCronJob(client, job.id);
      if (!removeResult.ok) {
        throw new Error(`Failed to delete cron job "${job.name}" (${job.id}).`);
      }
      return removeResult.removed ? 1 : 0;
    })
  );
  return results.reduce<number>((sum, n) => sum + n, 0);
};
