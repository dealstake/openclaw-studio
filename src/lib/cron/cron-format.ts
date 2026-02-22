/**
 * Cron job formatting utilities.
 */

import cronstrue from "cronstrue";
import type { CronSchedule, CronPayload, CronJobSummary } from "./cron-types";

export const formatEveryMs = (everyMs: number) => {
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

export const formatStagger = (staggerMs: number): string => {
  if (staggerMs <= 0) return "";
  return `±${formatEveryMs(staggerMs)}`;
};

export const formatCronSchedule = (schedule: CronSchedule) => {
  const stagger =
    "staggerMs" in schedule && schedule.staggerMs
      ? ` ${formatStagger(schedule.staggerMs)}`
      : "";

  if (schedule.kind === "every") {
    return `Every ${formatEveryMs(schedule.everyMs)}${stagger}`;
  }
  if (schedule.kind === "cron") {
    const human = formatCronHuman(schedule.expr);
    const base = schedule.tz ? `${human} (${schedule.tz})` : human;
    return `${base}${stagger}`;
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
