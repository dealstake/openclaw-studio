import cronstrue from "cronstrue";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { resolveRequiredId } from "@/lib/validation";

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string };

export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";

export type CronDeliveryMode = "none" | "announce";
export type CronDelivery = {
  mode: CronDeliveryMode;
  channel?: string;
  to?: string;
  bestEffort?: boolean;
};

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | {
      kind: "agentTurn";
      message: string;
      model?: string;
      thinking?: string;
      timeoutSeconds?: number;
      allowUnsafeExternalContent?: boolean;
      deliver?: boolean;
      channel?: string;
      to?: string;
      bestEffortDeliver?: boolean;
    };

export type CronJobState = {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
  runCount?: number;
};

export type CronJobSummary = {
  id: string;
  name: string;
  agentId?: string;
  enabled: boolean;
  createdAtMs?: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: CronSessionTarget;
  wakeMode: CronWakeMode;
  payload: CronPayload;
  state: CronJobState;
  delivery?: CronDelivery;
};

export type CronJobsResult = {
  jobs: CronJobSummary[];
};

export const filterCronJobsForAgent = (jobs: CronJobSummary[], agentId: string): CronJobSummary[] => {
  const trimmedAgentId = agentId.trim();
  if (!trimmedAgentId) return [];
  return jobs.filter((job) => job.agentId?.trim() === trimmedAgentId);
};

export const resolveLatestCronJobForAgent = (
  jobs: CronJobSummary[],
  agentId: string
): CronJobSummary | null => {
  const filtered = filterCronJobsForAgent(jobs, agentId);
  if (filtered.length === 0) return null;
  return [...filtered].sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0] ?? null;
};

const formatEveryMs = (everyMs: number) => {
  if (everyMs % 3600000 === 0) {
    return `${everyMs / 3600000}h`;
  }
  if (everyMs % 60000 === 0) {
    return `${everyMs / 60000}m`;
  }
  if (everyMs % 1000 === 0) {
    return `${everyMs / 1000}s`;
  }
  return `${everyMs}ms`;
};

/**
 * Convert a cron expression to a human-readable string.
 * Falls back to the raw expression if parsing fails.
 */
export const formatCronHuman = (expr: string): string => {
  try {
    return cronstrue.toString(expr, { use24HourTimeFormat: false });
  } catch {
    return expr;
  }
};

export const formatCronSchedule = (schedule: CronSchedule) => {
  if (schedule.kind === "every") {
    return `Every ${formatEveryMs(schedule.everyMs)}`;
  }
  if (schedule.kind === "cron") {
    const human = formatCronHuman(schedule.expr);
    return schedule.tz ? `${human} (${schedule.tz})` : human;
  }
  const atDate = new Date(schedule.at);
  if (Number.isNaN(atDate.getTime())) return `At: ${schedule.at}`;
  return `At: ${atDate.toLocaleString()}`;
};

export const formatCronPayload = (payload: CronPayload) => {
  if (payload.kind === "systemEvent") return payload.text;
  return payload.message;
};

export const formatCronJobDisplay = (job: CronJobSummary) => {
  const lines = [job.name, formatCronSchedule(job.schedule), formatCronPayload(job.payload)].filter(
    Boolean
  );
  return lines.join("\n");
};

export type CronListParams = {
  includeDisabled?: boolean;
};

export type CronRunResult =
  | { ok: true; ran: true }
  | { ok: true; ran: false; reason: "not-due" }
  | { ok: false };

export type CronRemoveResult = { ok: true; removed: boolean } | { ok: false; removed: false };

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

// ─── Add / Update ────────────────────────────────────────────────────────────

export type CronAddParams = {
  name: string;
  schedule: CronSchedule;
  sessionTarget: CronSessionTarget;
  payload: CronPayload;
  agentId?: string;
  enabled?: boolean;
  delivery?: CronDelivery;
};

/** Gateway returns the full job object on success, or {ok:false} on error. */
export type CronAddResult = { ok: true; jobId: string } | { ok: false };

export const addCronJob = async (
  client: GatewayClient,
  params: CronAddParams
): Promise<CronAddResult> => {
  const raw = await client.call<Record<string, unknown>>("cron.add", { job: params });
  // Gateway returns the full job object (with `id`) on success — normalize.
  if (raw && typeof raw === "object" && "id" in raw && typeof raw.id === "string") {
    return { ok: true, jobId: raw.id };
  }
  // Fallback: already in expected shape or error.
  if (raw && typeof raw === "object" && "ok" in raw) {
    return raw as CronAddResult;
  }
  return { ok: false };
};

export type CronUpdateParams = {
  name?: string;
  schedule?: CronSchedule;
  payload?: CronPayload;
  enabled?: boolean;
  delivery?: CronDelivery;
};

export type CronUpdateResult = { ok: true } | { ok: false };

export const updateCronJob = async (
  client: GatewayClient,
  jobId: string,
  patch: CronUpdateParams
): Promise<CronUpdateResult> => {
  const id = resolveJobId(jobId);
  return client.call<CronUpdateResult>("cron.update", { jobId: id, patch });
};

// ─── Cron Run Types ──────────────────────────────────────────────────────────

export type CronRunEntry = {
  id: string;
  jobId: string;
  status: string;
  startedAtMs?: number;
  durationMs?: number;
  error?: string;
};

export type CronRunsResult = {
  runs: CronRunEntry[];
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

// ─── Bulk remove ─────────────────────────────────────────────────────────────

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
