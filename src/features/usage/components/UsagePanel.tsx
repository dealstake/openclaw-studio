"use client";

import { memo, useEffect, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useUsageData, type TimeRange } from "@/features/usage/hooks/useUsageData";
import { SectionLabel } from "@/components/SectionLabel";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { PanelIconButton } from "@/components/PanelIconButton";
import { formatTokens, formatCost } from "@/lib/text/format";
import { DailyTrendChart } from "@/features/usage/components/DailyTrendChart";
import { CronCostTable } from "@/features/usage/components/CronCostTable";
import { SummaryCard } from "@/features/usage/components/SummaryCard";

const TIME_RANGES: Array<{ value: TimeRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

interface UsagePanelProps {
  client: GatewayClient;
  status: GatewayStatus;
}

export const UsagePanel = memo(function UsagePanel({
  client,
  status,
}: UsagePanelProps) {
  const {
    entries,
    totalCost,
    costByModel,
    dailyTrends,
    totalInputTokens,
    totalOutputTokens,
    totalSessions,
    loading,
    error,
    timeRange,
    setTimeRange,
    refresh,
  } = useUsageData(client, status);

  // Collect unique model names for the trend chart legend
  const models = useMemo(() => Array.from(costByModel.keys()), [costByModel]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Find top model by cost
  let topModel = "—";
  let topModelCost = 0;
  for (const [model, data] of costByModel) {
    if (data.cost > topModelCost) {
      topModel = model;
      topModelCost = data.cost;
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-3 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionLabel>Usage & Cost</SectionLabel>
        <PanelIconButton
          aria-label="Refresh"
          onClick={() => void refresh()}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </PanelIconButton>
      </div>

      {/* Time range toggle */}
      <div className="flex items-center gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setTimeRange(r.value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              timeRange === r.value
                ? "border-border bg-muted text-foreground shadow-xs"
                : "border-border/80 bg-card/65 text-muted-foreground hover:border-border hover:bg-muted/70"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {loading && !totalSessions ? (
          <>
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </>
        ) : (
          <>
            <SummaryCard label="Total Cost" value={formatCost(totalCost)} />
            <SummaryCard
              label="Tokens"
              value={formatTokens(totalInputTokens + totalOutputTokens)}
              subValue={`${formatTokens(totalInputTokens)} in / ${formatTokens(totalOutputTokens)} out`}
            />
            <SummaryCard label="Sessions" value={String(totalSessions)} />
            <SummaryCard label="Top Model" value={topModel} subValue={topModelCost > 0 ? formatCost(topModelCost) : undefined} />
          </>
        )}
      </div>

      {/* Truncation warning */}
      {totalSessions >= 200 && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          Showing data from 200 most recent sessions. Older sessions are excluded from totals.
        </p>
      )}

      {/* Cost by model table */}
      {costByModel.size > 0 && (
        <div>
          <SectionLabel className="mb-2">By Model</SectionLabel>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Model</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Sessions</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Tokens</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Cost</th>
                </tr>
              </thead>
              <tbody>
                {[...costByModel.entries()]
                  .sort(([, a], [, b]) => b.cost - a.cost)
                  .map(([model, data]) => (
                    <tr key={model} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground max-w-[120px] truncate" title={model}>{model}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{data.requests}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {formatTokens(data.inputTokens + data.outputTokens)}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">{formatCost(data.cost)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily trend chart */}
      {dailyTrends.length > 0 && (
        <div>
          <SectionLabel className="mb-2">Daily Trend</SectionLabel>
          <DailyTrendChart trends={dailyTrends} models={models} />
        </div>
      )}

      {/* Cron cost attribution */}
      {entries.some((e) => e.isCron) && (
        <div>
          <SectionLabel className="mb-2">Cron Cost Attribution</SectionLabel>
          <CronCostTable entries={entries} />
        </div>
      )}
    </div>
  );
});
