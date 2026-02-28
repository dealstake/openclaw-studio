"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useUsageData, type TimeRange } from "@/features/usage/hooks/useUsageData";
import { SectionLabel } from "@/components/SectionLabel";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { FilterGroup, type FilterGroupOption } from "@/components/ui/FilterGroup";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { PanelIconButton } from "@/components/PanelIconButton";
import { formatTokens, formatCost } from "@/lib/text/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DailyTrendChart } from "@/features/usage/components/DailyTrendChart";
import { CronCostTable } from "@/features/usage/components/CronCostTable";
import { AgentCostTable } from "@/features/usage/components/AgentCostTable";
import { SummaryCard } from "@/features/usage/components/SummaryCard";
import { SessionDrillDown } from "@/features/usage/components/SessionDrillDown";

type BreakdownView = "model" | "agent" | "cron";

const BREAKDOWN_OPTIONS: FilterGroupOption<BreakdownView>[] = [
  { value: "model", label: "By Model" },
  { value: "agent", label: "By Agent" },
  { value: "cron", label: "Cron Jobs" },
];

const TIME_RANGE_OPTIONS: FilterGroupOption<TimeRange>[] = [
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

  const [breakdownView, setBreakdownView] = useState<BreakdownView>("model");

  // Drill-down state
  const [drillDown, setDrillDown] = useState<{
    title: string;
    sessions: import("@/features/usage/lib/costCalculator").SessionCostEntry[];
  } | null>(null);

  // Collect unique model names for the trend chart legend
  const models = useMemo(() => Array.from(costByModel.keys()), [costByModel]);

  const hasCronEntries = useMemo(() => entries.some((e) => e.isCron), [entries]);

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

  // Phase 3: Enhanced KPI computations
  const costPerSession = totalSessions > 0 ? totalCost / totalSessions : 0;

  // Projected monthly cost: daily average × 30
  const projectedMonthlyCost = useMemo(() => {
    if (dailyTrends.length === 0) return 0;
    const totalTrendCost = dailyTrends.reduce((sum, d) => sum + d.totalCost, 0);
    const avgDaily = totalTrendCost / dailyTrends.length;
    return avgDaily * 30;
  }, [dailyTrends]);

  // Top agent by cost
  const { topAgent, topAgentCost } = useMemo(() => {
    const agentCosts = new Map<string, number>();
    for (const entry of entries) {
      const key = entry.key;
      let agentId = "(direct)";
      if (key.startsWith("agent:")) {
        const parts = key.split(":");
        if (parts.length >= 2 && parts[1]) agentId = parts[1];
      } else if (key.startsWith("cron-")) {
        agentId = "(cron)";
      }
      agentCosts.set(agentId, (agentCosts.get(agentId) ?? 0) + (entry.cost ?? 0));
    }
    let best = "—";
    let bestCost = 0;
    for (const [id, cost] of agentCosts) {
      if (cost > bestCost) { best = id; bestCost = cost; }
    }
    return { topAgent: best, topAgentCost: bestCost };
  }, [entries]);

  /** Open drill-down for a specific day */
  const handleBarClick = useCallback(
    (date: string) => {
      const daySessions = entries.filter((e) => {
        if (e.updatedAt == null) return false;
        const d = new Date(e.updatedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return key === date;
      });
      const label = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      setDrillDown({ title: label, sessions: daySessions });
    },
    [entries],
  );

  /** Open drill-down for a specific agent */
  const handleAgentClick = useCallback(
    (agentId: string) => {
      const agentSessions = entries.filter((e) => {
        if (e.key.startsWith("agent:")) {
          const parts = e.key.split(":");
          return parts.length >= 2 && parts[1] === agentId;
        }
        if (e.key.startsWith("cron-")) return agentId === "(cron)";
        return agentId === "(direct)";
      });
      setDrillDown({ title: agentId, sessions: agentSessions });
    },
    [entries],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-3 pb-3 gap-4">
      {/* Header */}
      <PanelHeader
        icon={<BarChart3 className="h-4 w-4" />}
        title="Usage & Cost"
        actions={
          <PanelIconButton
            aria-label="Refresh"
            onClick={() => void refresh()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </PanelIconButton>
        }
        filters={
          <FilterGroup
            options={TIME_RANGE_OPTIONS}
            value={[timeRange]}
            onChange={(v) => { if (v.length > 0) setTimeRange(v[v.length - 1]!); }}
            allowEmpty={false}
          />
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              label="Projected Monthly"
              value={formatCost(projectedMonthlyCost)}
              subValue={`~${formatCost(projectedMonthlyCost / 30)}/day avg`}
            />
            <SummaryCard
              label="Cost / Session"
              value={formatCost(costPerSession)}
              subValue={`${totalSessions} sessions`}
            />
            <SummaryCard
              label="Top Agent"
              value={topAgent}
              subValue={topAgentCost > 0 ? formatCost(topAgentCost) : undefined}
            />
          </>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <SummaryCard
          label="Tokens"
          value={formatTokens(totalInputTokens + totalOutputTokens)}
          subValue={`${formatTokens(totalInputTokens)} in / ${formatTokens(totalOutputTokens)} out`}
        />
        <SummaryCard label="Sessions" value={String(totalSessions)} />
        <SummaryCard label="Top Model" value={topModel} subValue={topModelCost > 0 ? formatCost(topModelCost) : undefined} />
      </div>

      {/* Truncation warning */}
      {totalSessions >= 2000 && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          Showing data from 2,000 most recent sessions. Older sessions are excluded from totals.
        </p>
      )}

      {/* Daily trend chart */}
      {dailyTrends.length > 0 && (
        <div>
          <SectionLabel className="mb-2">Daily Trend</SectionLabel>
          <DailyTrendChart trends={dailyTrends} models={models} onBarClick={handleBarClick} />
        </div>
      )}

      {/* Breakdown view switcher */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <SectionLabel>Breakdown</SectionLabel>
          <FilterGroup
            options={BREAKDOWN_OPTIONS}
            value={[breakdownView]}
            onChange={(v) => { if (v.length > 0) setBreakdownView(v[v.length - 1]!); }}
            allowEmpty={false}
          />
        </div>

        {breakdownView === "model" && costByModel.size > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">Model</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">Sessions</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">Tokens</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">Cost</th>
                </tr>
              </thead>
              <tbody>
                {[...costByModel.entries()]
                  .sort(([, a], [, b]) => b.cost - a.cost)
                  .map(([model, data]) => (
                    <tr key={model} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground max-w-[120px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{model}</span>
                            </TooltipTrigger>
                            <TooltipContent side="right">{model}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
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
        )}

        {breakdownView === "agent" && <AgentCostTable entries={entries} onAgentClick={handleAgentClick} />}

        {breakdownView === "cron" && hasCronEntries && <CronCostTable entries={entries} />}
        {breakdownView === "cron" && !hasCronEntries && (
          <p className="text-xs text-muted-foreground py-4 text-center">No cron sessions in this time range.</p>
        )}
      </div>

      {/* Session drill-down side sheet */}
      <SessionDrillDown
        title={drillDown?.title ?? ""}
        sessions={drillDown?.sessions ?? []}
        open={drillDown !== null}
        onClose={() => setDrillDown(null)}
      />
    </div>
  );
});
