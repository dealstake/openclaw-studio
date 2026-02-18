import type { CronRunEntry } from "@/lib/cron/types";

export interface JobStats {
  jobId: string;
  jobName: string;
  totalRuns: number;
  successCount: number;
  failCount: number;
  totalTokens: number;
  avgTokens: number;
  avgDurationMs: number;
  durationTrend: number[];
  tokenTrend: number[];
  successRate: number;
}

/**
 * Compute stats for a single cron job from its run history.
 * `sessionTokenMap` maps session timestamps (ms) → totalTokens for token join.
 */
export function computeJobStats(
  jobId: string,
  jobName: string,
  runs: CronRunEntry[],
  sessionTokenMap: Map<number, number> = new Map()
): JobStats {
  const totalRuns = runs.length;
  const successCount = runs.filter((r) => r.status === "ok").length;
  const failCount = runs.filter((r) => r.status === "error").length;

  const durations = runs.map((r) => r.durationMs ?? 0);
  const avgDurationMs =
    totalRuns > 0 ? durations.reduce((a, b) => a + b, 0) / totalRuns : 0;

  // Token join: match run startedAtMs to session timestamps within ±30s window
  const WINDOW_MS = 30_000;
  let totalTokens = 0;
  const tokenTrend: number[] = [];
  for (const run of runs) {
    let matched = 0;
    if (run.startedAtMs) {
      for (const [ts, tokens] of sessionTokenMap) {
        if (Math.abs(ts - run.startedAtMs) <= WINDOW_MS) {
          matched = tokens;
          break;
        }
      }
    }
    totalTokens += matched;
    tokenTrend.push(matched);
  }

  const avgTokens = totalRuns > 0 ? totalTokens / totalRuns : 0;
  const successRate = totalRuns > 0 ? successCount / totalRuns : 0;

  // Duration trend: last 20 runs (oldest first)
  const durationTrend = durations.slice(-20);

  return {
    jobId,
    jobName,
    totalRuns,
    successCount,
    failCount,
    totalTokens,
    avgTokens,
    avgDurationMs,
    durationTrend,
    tokenTrend: tokenTrend.slice(-20),
    successRate,
  };
}

/** Rank jobs by total token usage, descending. */
export function rankJobsByTokens(stats: JobStats[]): JobStats[] {
  return [...stats].sort((a, b) => b.totalTokens - a.totalTokens);
}
