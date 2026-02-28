/**
 * Server-side usage query hook.
 *
 * Calls the `/api/usage/query` route (which proxies to the gateway
 * with server-side caching) instead of doing client-side aggregation.
 *
 * Falls back to the client-side `useUsageData` hook if the API route
 * is unavailable (e.g. network error).
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { ModelCostBreakdown } from "@/features/usage/lib/costCalculator";
import type { TrendBucket } from "@/features/usage/lib/trendAggregator";

export type TimeRange = "today" | "7d" | "30d" | "all";

type AgentBreakdown = {
  agentId: string;
  sessions: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
};

type UsageQueryResponse = {
  totalCost: number;
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costByModel: Record<string, ModelCostBreakdown>;
  dailyTrends: TrendBucket[];
  agentBreakdown: AgentBreakdown[];
  projectedMonthlyCost: number;
  cachedAt: string;
  error?: string;
};

export type UsageQueryData = {
  totalCost: number;
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costByModel: Map<string, ModelCostBreakdown>;
  dailyTrends: TrendBucket[];
  agentBreakdown: AgentBreakdown[];
  projectedMonthlyCost: number;
  loading: boolean;
  error: string | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  agentIdFilter: string | null;
  setAgentIdFilter: (id: string | null) => void;
  refresh: () => Promise<void>;
  /** ISO timestamp of when the server cache was populated */
  cachedAt: string | null;
};

const THROTTLE_MS = 5_000;

function timeRangeToFrom(range: TimeRange): string | undefined {
  if (range === "all") return undefined;
  const now = Date.now();
  const offsets: Record<string, number> = {
    today: 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  return new Date(now - (offsets[range] ?? 0)).toISOString();
}

export function useUsageQuery(): UsageQueryData {
  const [data, setData] = useState<UsageQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [agentIdFilter, setAgentIdFilter] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const lastCallRef = useRef(0);

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    const now = Date.now();
    if (now - lastCallRef.current < THROTTLE_MS) return;
    lastCallRef.current = now;
    loadingRef.current = true;
    setLoading(true);

    try {
      const body: Record<string, string | undefined> = {
        from: timeRangeToFrom(timeRange),
      };
      if (agentIdFilter) body.agentId = agentIdFilter;

      const res = await fetch("/api/usage/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const result = (await res.json()) as UsageQueryResponse;
      setData(result);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch usage data";
      setError(message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [timeRange, agentIdFilter]);

  const costByModel = useMemo(() => {
    if (!data?.costByModel) return new Map<string, ModelCostBreakdown>();
    return new Map(Object.entries(data.costByModel));
  }, [data?.costByModel]);

  return {
    totalCost: data?.totalCost ?? 0,
    totalSessions: data?.totalSessions ?? 0,
    totalInputTokens: data?.totalInputTokens ?? 0,
    totalOutputTokens: data?.totalOutputTokens ?? 0,
    costByModel,
    dailyTrends: data?.dailyTrends ?? [],
    agentBreakdown: data?.agentBreakdown ?? [],
    projectedMonthlyCost: data?.projectedMonthlyCost ?? 0,
    loading,
    error,
    timeRange,
    setTimeRange,
    agentIdFilter,
    setAgentIdFilter,
    refresh,
    cachedAt: data?.cachedAt ?? null,
  };
}
