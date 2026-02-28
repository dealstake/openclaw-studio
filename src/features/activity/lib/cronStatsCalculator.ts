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
 * Match a cron run to its session's token count.
 *
 * Strategy:
 * 1. **Key-based** (reliable): Check if any session key contains the jobId.
 *    Cron sessions are typically keyed as `cron-<jobId>-<runId>` or similar.
 *    Among matches, pick the one closest in time to the run's start.
 * 2. **Timestamp fallback** (heuristic): Match run startedAtMs to session
 *    updatedAt within ±30s window. This is fragile when multiple jobs run
 *    concurrently but covers sessions with opaque keys.
 */
function matchRunTokens(
  run: CronRunEntry,
  sessionTokenMap: Map<number, number>,
  sessionsByKey: Map<string, { updatedAt?: number | null; totalTokens?: number | null }>
): number {
  const WINDOW_MS = 30_000;

  // Strategy 1: key-based matching
  if (run.startedAtMs) {
    let bestMatch = 0;
    let bestDelta = Infinity;
    for (const [key, session] of sessionsByKey) {
      if (!key.includes(run.jobId) || !session.totalTokens) continue;
      const delta = session.updatedAt
        ? Math.abs(session.updatedAt - run.startedAtMs)
        : Infinity;
      if (delta < bestDelta) {
        bestDelta = delta;
        bestMatch = session.totalTokens;
      }
    }
    if (bestMatch > 0) return bestMatch;
  }

  // Strategy 2: timestamp fallback
  if (run.startedAtMs) {
    for (const [ts, tokens] of sessionTokenMap) {
      if (Math.abs(ts - run.startedAtMs) <= WINDOW_MS) {
        return tokens;
      }
    }
  }

  return 0;
}

/**
 * Compute stats for a single cron job from its run history.
 *
 * `sessionTokenMap` maps session updatedAt (ms) → totalTokens (timestamp fallback).
 * `sessionsByKey` maps session key → session data (key-based matching, preferred).
 */
export function computeJobStats(
  jobId: string,
  jobName: string,
  runs: CronRunEntry[],
  sessionTokenMap: Map<number, number> = new Map(),
  sessionsByKey: Map<string, { updatedAt?: number | null; totalTokens?: number | null }> = new Map()
): JobStats {
  const totalRuns = runs.length;
  const successCount = runs.filter((r) => r.status === "ok").length;
  const failCount = runs.filter((r) => r.status === "error").length;

  const durations = runs.map((r) => r.durationMs ?? 0);
  const avgDurationMs =
    totalRuns > 0 ? durations.reduce((a, b) => a + b, 0) / totalRuns : 0;

  // Token join: try key-based matching first, fall back to timestamp heuristic
  let totalTokens = 0;
  const tokenTrend: number[] = [];
  for (const run of runs) {
    const matched = matchRunTokens(run, sessionTokenMap, sessionsByKey);
    totalTokens += matched;
    // Only include matched runs in trend — zeros from unmatched runs
    // create misleading dips in the sparkline
    if (matched > 0) tokenTrend.push(matched);
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
