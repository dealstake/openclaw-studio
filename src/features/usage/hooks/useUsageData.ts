import { useCallback, useMemo, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import {
  calculateSessionCosts,
  type RawSessionEntry,
  type SessionCostEntry,
  type ModelCostBreakdown,
} from "@/features/usage/lib/costCalculator";
import {
  aggregateByDay,
  filterByTimeRange,
  type TrendBucket,
} from "@/features/usage/lib/trendAggregator";

export type TimeRange = "today" | "7d" | "30d" | "all";

type SessionsListResult = {
  sessions?: RawSessionEntry[];
};

export type UsageData = {
  entries: SessionCostEntry[];
  totalCost: number;
  costByModel: Map<string, ModelCostBreakdown>;
  dailyTrends: TrendBucket[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalSessions: number;
  loading: boolean;
  error: string | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  refresh: () => Promise<void>;
};

const THROTTLE_MS = 5000;

export const useUsageData = (
  client: GatewayClient,
  status: GatewayStatus
): UsageData => {
  const [allEntries, setAllEntries] = useState<SessionCostEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const loadingRef = useRef(false);
  const lastCallRef = useRef(0);

  const refresh = useCallback(async () => {
    if (status !== "connected" || loadingRef.current) return;
    const now = Date.now();
    if (now - lastCallRef.current < THROTTLE_MS) return;
    lastCallRef.current = now;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await client.call<SessionsListResult>("sessions.list", {
        includeGlobal: true,
        includeUnknown: true,
        limit: 2000,
      });
      const raw = result.sessions ?? [];
      const { entries } = calculateSessionCosts(raw);
      setAllEntries(entries);
      setError(null);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message =
          err instanceof Error ? err.message : "Failed to load usage data.";
        setError(message);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [client, status]);

  // Derived state: filter + aggregate (memoized)
  const filtered = useMemo(
    () => filterByTimeRange(allEntries, timeRange),
    [allEntries, timeRange]
  );

  const { costByModel, totalCost, totalInputTokens, totalOutputTokens } =
    useMemo(() => {
      const byModel = new Map<string, ModelCostBreakdown>();
      let cost = 0;
      let inTok = 0;
      let outTok = 0;

      for (const entry of filtered) {
        inTok += entry.inputTokens;
        outTok += entry.outputTokens;
        if (entry.cost !== null) cost += entry.cost;

        const existing = byModel.get(entry.modelDisplayName);
        if (existing) {
          existing.requests += 1;
          existing.inputTokens += entry.inputTokens;
          existing.outputTokens += entry.outputTokens;
          existing.cost += entry.cost ?? 0;
        } else {
          byModel.set(entry.modelDisplayName, {
            requests: 1,
            inputTokens: entry.inputTokens,
            outputTokens: entry.outputTokens,
            cost: entry.cost ?? 0,
          });
        }
      }

      return {
        costByModel: byModel,
        totalCost: cost,
        totalInputTokens: inTok,
        totalOutputTokens: outTok,
      };
    }, [filtered]);

  const dailyTrends = useMemo(() => aggregateByDay(filtered), [filtered]);

  return {
    entries: filtered,
    totalCost,
    costByModel,
    dailyTrends,
    totalInputTokens,
    totalOutputTokens,
    totalSessions: filtered.length,
    loading,
    error,
    timeRange,
    setTimeRange,
    refresh,
  };
};
