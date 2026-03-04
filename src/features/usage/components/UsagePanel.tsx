"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { useUsageQuery, type TimeRange } from "@/features/usage/hooks/useUsageQuery";
import { SectionLabel } from "@/components/SectionLabel";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { FilterGroup, type FilterGroupOption } from "@/components/ui/FilterGroup";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { IconButton } from "@/components/IconButton";
import { formatTokens, formatCost } from "@/lib/text/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DailyTrendChart } from "@/features/usage/components/DailyTrendChart";
import { CronCostTable } from "@/features/usage/components/CronCostTable";
import { AgentCostTable } from "@/features/usage/components/AgentCostTable";
import { SummaryCard } from "@/features/usage/components/SummaryCard";
import { BudgetAlert } from "@/features/usage/components/BudgetAlert";
import { SavingsCard } from "@/features/routing/components/SavingsCard";
import { ToolPerformanceTable } from "@/features/usage/components/ToolPerformanceTable";
import { useToolMetrics } from "@/features/usage/hooks/useToolMetrics";

type BreakdownView = "model" | "agent" | "cron" | "tool";

const BREAKDOWN_OPTIONS: FilterGroupOption<BreakdownView>[] = [
  { value: "model", label: "By Model" },
  { value: "agent", label: "By Agent" },
  { value: "cron", label: "Cron Jobs" },
  { value: "tool", label: "By Tool" },
];

const TIME_RANGE_OPTIONS: FilterGroupOption<TimeRange>[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

// UsagePanel uses server-side aggregation via useUsageQuery and does not
// require a GatewayClient or GatewayStatus — the /api/usage/query route
// handles gateway communication server-side.
export const UsagePanel = memo(function UsagePanel() {
  const {
    totalCost,
    costByModel,
    dailyTrends,
    totalInputTokens,
    totalOutputTokens,
    totalSessions,
    agentBreakdown,
    cronBreakdown,
    projectedMonthlyCost,
    savings,
    loading,
    error,
    timeRange,
    setTimeRange,
    refresh,
    cachedAt,
  } = useUsageQuery();

  const [breakdownView, setBreakdownView] = useState<BreakdownView>("model");
  const {
    metrics: toolMetrics,
    loading: toolLoading,
    refresh: refreshTools,
  } = useToolMetrics();

  // Collect unique model names for the trend chart legend
  const models = useMemo(() => Array.from(costByModel.keys()), [costByModel]);

  // Trigger initial fetch; re-fetches automatically when timeRange changes
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Fetch tool metrics when "By Tool" tab is selected
  useEffect(() => {
    if (breakdownView === "tool") {
      const days = timeRange === "today" ? 1 : timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      void refreshTools(days);
    }
  }, [breakdownView, timeRange, refreshTools]);

  // Cost per session
  const costPerSession = totalSessions > 0 ? totalCost / totalSessions : 0;

  // Top model by cost
  let topModel = "—";
  let topModelCost = 0;
  for (const [model, data] of costByModel) {
    if (data.cost > topModelCost) {
      topModel = model;
      topModelCost = data.cost;
    }
  }

  // Top agent by cost — agentBreakdown is already sorted desc by cost from server
  const topAgent = agentBreakdown[0]?.agentId ?? "—";
  const topAgentCost = agentBreakdown[0]?.cost ?? 0;

  // Whether any cron sessions exist in the current time range
  const hasCronEntries = cronBreakdown.length > 0;

  // Show a simple "cached" indicator when data was fetched from server cache
  const hasCachedData = cachedAt !== null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-3 pb-3 gap-4">
      {/* Header */}
      <PanelHeader
        icon={<BarChart3 className="h-4 w-4" />}
        title="Usage & Cost"
        actions={
          <div className="flex items-center gap-2">
            {hasCachedData && !loading && (
              <span className="text-xs text-muted-foreground hidden sm:block" aria-label="Data from server cache">
                cached
              </span>
            )}
            <IconButton
              aria-label="Refresh"
              onClick={() => void refresh()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </IconButton>
          </div>
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

      {error && !/gateway|websocket/i.test(error) && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      {/* Budget alert */}
      <BudgetAlert currentSpend={totalCost} />

      {/* Routing savings */}
      {savings && <SavingsCard savings={savings} />}

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
              subValue={projectedMonthlyCost / 30 >= 0.01 ? `~${formatCost(projectedMonthlyCost / 30)}/day avg` : undefined}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          label="Tokens"
          value={formatTokens(totalInputTokens + totalOutputTokens)}
          subValue={`${formatTokens(totalInputTokens)} in / ${formatTokens(totalOutputTokens)} out`}
        />
        <SummaryCard label="Sessions" value={String(totalSessions)} />
        <SummaryCard label="Top Model" value={topModel} subValue={topModelCost > 0 ? formatCost(topModelCost) : undefined} />
      </div>

      {/* Truncation notice */}
      {totalSessions >= 2000 && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          Showing data from 2,000 most recent sessions. Older sessions are excluded from totals.
        </p>
      )}

      {/* Daily trend chart */}
      {dailyTrends.length > 0 && (
        <div>
          <SectionLabel className="mb-2">Daily Trend</SectionLabel>
          <DailyTrendChart trends={dailyTrends} models={models} />
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
            <TooltipProvider>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th scope="col" className="px-3 py-3 text-left font-medium text-muted-foreground">Model</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium text-muted-foreground">Sessions</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium text-muted-foreground">Tokens</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium text-muted-foreground">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {[...costByModel.entries()]
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([model, data]) => (
                      <tr key={model} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-3 font-medium text-foreground max-w-[120px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">{model}</span>
                            </TooltipTrigger>
                            <TooltipContent side="right">{model}</TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{data.requests}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">
                          {formatTokens(data.inputTokens + data.outputTokens)}
                        </td>
                        <td className="px-3 py-3 text-right text-foreground">{formatCost(data.cost)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </TooltipProvider>
          </div>
        )}

        {breakdownView === "model" && costByModel.size === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">No model sessions in this time range.</p>
        )}

        {breakdownView === "agent" && agentBreakdown.length > 0 && (
          <AgentCostTable serverGroups={agentBreakdown} />
        )}
        {breakdownView === "agent" && agentBreakdown.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">No agent sessions in this time range.</p>
        )}

        {breakdownView === "cron" && hasCronEntries && (
          <CronCostTable serverGroups={cronBreakdown} />
        )}
        {breakdownView === "cron" && !hasCronEntries && (
          <p className="text-xs text-muted-foreground py-4 text-center">No cron sessions in this time range.</p>
        )}

        {breakdownView === "tool" && (
          toolLoading
            ? <Skeleton className="h-40 rounded-lg" />
            : <ToolPerformanceTable metrics={toolMetrics} />
        )}
      </div>
    </div>
  );
});
