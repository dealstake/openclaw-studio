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

      // Fetch runs for all enabled jobs in parallel
      const runsResults = await Promise.all(
        enabledJobs.map(async (job) => ({
          job,
          runs: await fetchCronRuns(client, job.id, 50),
        }))
      );

      // Fetch sessions for token join — filter by kind client-side since the
      // sessions.list RPC does not support a `kinds` parameter.
      const sessionsResult = await client.call<SessionsListResult>(
        "sessions.list",
        { limit: 200 }
      );
      const sessionTokenMap = new Map<number, number>();
      for (const s of sessionsResult.sessions ?? []) {
        if (s.kind !== "cron") continue;
        if (s.updatedAt && s.totalTokens) {
          sessionTokenMap.set(s.updatedAt, s.totalTokens);
        }
      }

      // Compute stats per job
      const stats = runsResults.map(({ job, runs }) =>
        computeJobStats(job.id, job.name, runs, sessionTokenMap)
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
