"use client";

import { useCallback, useRef, useState } from "react";
import type { ToolMetric } from "@/features/usage/lib/toolMetrics";

interface UseToolMetricsResult {
  metrics: ToolMetric[];
  eventsAnalyzed: number;
  loading: boolean;
  error: string | null;
  refresh: (days?: number) => Promise<void>;
}

export function useToolMetrics(): UseToolMetricsResult {
  const [metrics, setMetrics] = useState<ToolMetric[]>([]);
  const [eventsAnalyzed, setEventsAnalyzed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const refresh = useCallback(async (days = 7) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ days: String(days) });
      const res = await fetch(`/api/usage/tools?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMetrics(data.metrics ?? []);
      setEventsAnalyzed(data.eventsAnalyzed ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tool metrics");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  return { metrics, eventsAnalyzed, loading, error, refresh };
}
