import { useCallback, useRef, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { fetchCronRuns, type CronRunEntry } from "@/lib/cron/types";

/**
 * Hook to fetch cron run history for a single job.
 * Extracted from CronJobListItem for reusability.
 */
export function useCronRuns(client: GatewayClient, jobId: string, limit = 10) {
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const entries = await fetchCronRuns(client, jobId, limit);
      setRuns(entries);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message =
          err instanceof Error ? err.message : "Failed to load run history.";
        setError(message);
      }
      setRuns([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [client, jobId, limit]);

  const reset = useCallback(() => {
    setRuns([]);
    setError(null);
  }, []);

  return { runs, loading, error, load, reset };
}
