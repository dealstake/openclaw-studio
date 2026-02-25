import { useCallback, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { CronJobSummary } from "@/lib/cron/types";
import { fetchCronRuns } from "@/lib/cron/types";
import { computeJobStats, rankJobsByTokens, type JobStats } from "../lib/cronStatsCalculator";
import type { SessionsListResult } from "@/lib/gateway/types";

export const useCronAnalytics = (
  client: GatewayClient,
  status: GatewayStatus,
  cronJobs: CronJobSummary[]
) => {
  const [jobStats, setJobStats] = useState<JobStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (status !== "connected" || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const enabledJobs = cronJobs.filter((j) => j.enabled);

      // Fetch runs for all enabled jobs with concurrency limit of 3
      // to avoid overwhelming the gateway with simultaneous RPC calls
      const runsResults: { job: CronJobSummary; runs: Awaited<ReturnType<typeof fetchCronRuns>> }[] = [];
      const CONCURRENCY = 3;
      for (let i = 0; i < enabledJobs.length; i += CONCURRENCY) {
        const batch = enabledJobs.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async (job) => ({
            job,
            runs: await fetchCronRuns(client, job.id, 50),
          }))
        );
        runsResults.push(...batchResults);
      }

      // Fetch cron sessions for token join.
      // Use kinds filter + higher limit to capture older cron runs that
      // would otherwise be crowded out by non-cron sessions.
      const sessionsResult = await client.call<SessionsListResult>(
        "sessions.list",
        { kinds: ["cron"], limit: 500 }
      );
      const cronSessions = sessionsResult.sessions ?? [];

      // Build lookup maps for robust run → session matching:
      // 1. Primary: session key contains jobId (e.g. "cron-<jobId>-<timestamp>")
      // 2. Fallback: timestamp-based matching within ±30s window
      const sessionsByKey = new Map<string, { updatedAt?: number | null; totalTokens?: number | null }>();
      const sessionTokenMap = new Map<number, number>();
      for (const s of cronSessions) {
        sessionsByKey.set(s.key, s);
        if (s.updatedAt && s.totalTokens) {
          sessionTokenMap.set(s.updatedAt, s.totalTokens);
        }
      }

      // Compute stats per job — pass both lookup maps for robust matching
      const stats = runsResults.map(({ job, runs }) =>
        computeJobStats(job.id, job.name, runs, sessionTokenMap, sessionsByKey)
      );

      setJobStats(rankJobsByTokens(stats));
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message =
          err instanceof Error ? err.message : "Failed to load cron analytics.";
        setError(message);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [client, status, cronJobs]);

  return { jobStats, loading, error, refresh };
};
