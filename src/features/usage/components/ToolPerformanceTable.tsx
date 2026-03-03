"use client";

import { memo, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";
import { TrendSparkline } from "@/features/activity/components/TrendSparkline";
import type { ToolMetric } from "@/features/usage/lib/toolMetrics";

type SortKey = "toolName" | "invocations" | "errorRate" | "avgLatencyMs";

function errorRateColor(rate: number): string {
  if (rate < 0.05) return "text-emerald-600 dark:text-emerald-400";
  if (rate < 0.15) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function errorRateBg(rate: number): string {
  if (rate < 0.05) return "bg-emerald-500/10";
  if (rate < 0.15) return "bg-amber-500/10";
  return "bg-red-500/10";
}

interface ToolPerformanceTableProps {
  metrics: ToolMetric[];
}

export const ToolPerformanceTable = memo(function ToolPerformanceTable({
  metrics,
}: ToolPerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("invocations");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...metrics].sort((a, b) => {
      if (sortKey === "toolName") return dir * a.toolName.localeCompare(b.toolName);
      return dir * (a[sortKey] - b[sortKey]);
    });
  }, [metrics, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (sorted.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No tool usage data available. Tool metrics are extracted from session transcripts.
      </p>
    );
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key
      ? sortAsc
        ? <ArrowUp className="inline h-3 w-3" />
        : <ArrowDown className="inline h-3 w-3" />
      : null;

  const columns = [
    ["toolName", "Tool", "text-left"],
    ["invocations", "Calls", "text-right"],
    ["errorRate", "Error Rate", "text-right"],
    ["avgLatencyMs", "Avg Latency", "text-right"],
  ] as const;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {/* Expand column */}
            <th scope="col" className="w-8 px-2 py-3" />
            {columns.map(([key, label, align]) => (
              <th
                key={key}
                scope="col"
                className={`p-0 font-medium text-foreground/80 ${align}`}
                aria-sort={sortKey === key ? (sortAsc ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  className={`flex w-full min-h-[44px] items-center gap-0.5 bg-transparent border-0 px-3 py-3 font-medium text-inherit cursor-pointer select-none hover:text-foreground transition-colors ${align === "text-right" ? "justify-end" : "justify-start"}`}
                  onClick={() => handleSort(key as SortKey)}
                >
                  {label}{sortIndicator(key as SortKey)}
                </button>
              </th>
            ))}
            <th scope="col" className="px-3 py-3 text-right font-medium text-foreground/80">
              Trend (7d)
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => {
            const isExpanded = expandedTool === m.toolName;
            return (
              <ToolRow
                key={m.toolName}
                metric={m}
                isExpanded={isExpanded}
                onToggle={() => setExpandedTool(isExpanded ? null : m.toolName)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

// ─── Row Component ──────────────────────────────────────────────────────────

const ToolRow = memo(function ToolRow({
  metric,
  isExpanded,
  onToggle,
}: {
  metric: ToolMetric;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasError = metric.lastError !== null;

  return (
    <>
      <tr
        className={`border-b border-border/50 last:border-0 ${hasError ? "hover:bg-muted/50" : ""} transition-colors h-11`}
      >
        <td className="w-8 px-2 py-3 text-muted-foreground">
          {hasError ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-controls={`tool-details-${metric.toolName}`}
              aria-label={`Expand details for ${metric.toolName}`}
              className="flex items-center justify-center min-h-[44px] min-w-[44px]"
            >
              {isExpanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </td>
        <td className="px-3 py-3 font-medium text-foreground font-mono text-xs">
          {metric.toolName}
        </td>
        <td className="px-3 py-3 text-right text-muted-foreground">
          {metric.invocations.toLocaleString()}
        </td>
        <td className="px-3 py-3 text-right">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${errorRateColor(metric.errorRate)} ${errorRateBg(metric.errorRate)}`}
          >
            {(metric.errorRate * 100).toFixed(1)}%
          </span>
          {metric.errorCount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({metric.errorCount})
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-right text-muted-foreground">
          {metric.avgLatencyMs > 0 ? `${metric.avgLatencyMs.toLocaleString()}ms` : "—"}
        </td>
        <td className="px-3 py-3 text-right">
          {metric.errorRateTrend.length > 0 && (
            <div className="flex justify-end">
              <TrendSparkline
                data={metric.errorRateTrend}
                width={56}
                height={16}
                color={metric.errorRate >= 0.15 ? "#ef4444" : metric.errorRate >= 0.05 ? "#f59e0b" : "#10b981"}
              />
            </div>
          )}
        </td>
      </tr>
      {isExpanded && hasError && (
        <tr id={`tool-details-${metric.toolName}`} className="border-b border-border/50">
          <td colSpan={6} className="px-6 py-3 bg-muted/30">
            <div className="text-xs">
              <span className="font-medium text-muted-foreground">Last error: </span>
              <span className="text-red-600 dark:text-red-400 font-mono">{metric.lastError}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});
