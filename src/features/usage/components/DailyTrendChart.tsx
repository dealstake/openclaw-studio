"use client";

import { memo } from "react";
import { formatCost } from "@/lib/text/format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TrendBucket } from "@/features/usage/lib/trendAggregator";

/** Rotating chart color palette using semantic tokens (themeable via CSS custom props). */
const CHART_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

function getModelColor(_model: string, idx: number): string {
  return CHART_COLORS[idx % CHART_COLORS.length];
}

function formatDateLabel(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Per-day savings overlay data */
export type DailySavingsOverlay = Map<
  string,
  { originalCost: number; routedCost: number }
>;

interface DailyTrendChartProps {
  trends: TrendBucket[];
  models: string[];
  /** Called when a bar is clicked with the date key (YYYY-MM-DD). */
  onBarClick?: (date: string) => void;
  /** Optional: show "cost without routing" ghost bar behind the actual bar */
  savingsOverlay?: DailySavingsOverlay;
}

export const DailyTrendChart = memo(function DailyTrendChart({
  trends,
  models,
  onBarClick,
  savingsOverlay,
}: DailyTrendChartProps) {
  if (trends.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No data for this time range.</p>
    );
  }

  // If savings overlay exists, max cost should include the original (higher) cost
  const maxCost = Math.max(
    ...trends.map((t) => {
      const overlay = savingsOverlay?.get(t.date);
      return overlay ? Math.max(t.totalCost, overlay.originalCost) : t.totalCost;
    }),
    0.01,
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="flex flex-col gap-1.5"
        role="img"
        aria-label={`Daily cost trend chart showing ${trends.length} day${trends.length !== 1 ? "s" : ""} across ${models.length} model${models.length !== 1 ? "s" : ""}`}
      >
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-1" aria-hidden="true">
          {models.map((model, i) => (
            <div key={model} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-sm ${getModelColor(model, i)}`} />
              <span className="text-xs text-muted-foreground">{model}</span>
            </div>
          ))}
        </div>

        {/* Bars */}
        {trends.map((trend) => {
          const widthPct = (trend.totalCost / maxCost) * 100;
          const modelEntries = models
            .map((m, i) => ({ model: m, cost: trend.costByModel[m] ?? 0, idx: i }))
            .filter((e) => e.cost > 0);
          const totalForBar = modelEntries.reduce((s, e) => s + e.cost, 0);
          const barLabel = `${formatDateLabel(trend.date)}: ${formatCost(trend.totalCost)} across ${trend.sessionCount} session${trend.sessionCount !== 1 ? "s" : ""}`;

          const overlay = savingsOverlay?.get(trend.date);
          const ghostWidthPct = overlay
            ? (overlay.originalCost / maxCost) * 100
            : 0;

          return (
            <div key={trend.date} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                {formatDateLabel(trend.date)}
              </span>
              <div className="relative flex-1 flex items-center">
                {/* Ghost bar: cost without routing */}
                {overlay && ghostWidthPct > widthPct && (
                  <div
                    className="absolute h-11 rounded-sm bg-muted/40 border border-dashed border-border/40"
                    style={{ width: `${Math.max(ghostWidthPct, 2)}%` }}
                    aria-hidden="true"
                  />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`relative z-10 flex h-11 items-center rounded-sm overflow-hidden ${onBarClick ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default"}`}
                      style={{ width: `${Math.max(widthPct, 2)}%` }}
                      role={onBarClick ? "button" : "graphics-symbol"}
                      tabIndex={onBarClick ? 0 : undefined}
                      aria-label={barLabel}
                      onClick={onBarClick ? () => onBarClick(trend.date) : undefined}
                      onKeyDown={onBarClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBarClick(trend.date); } } : undefined}
                    >
                      {modelEntries.map((e) => {
                        const segPct = totalForBar > 0 ? (e.cost / totalForBar) * 100 : 0;
                        return (
                          <div
                            key={e.model}
                            className={`${getModelColor(e.model, e.idx)} min-w-[2px] h-5`}
                            style={{ width: `${segPct}%` }}
                          />
                        );
                      })}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-medium">{formatDateLabel(trend.date)} — {formatCost(trend.totalCost)}</p>
                    <p className="text-muted-foreground">{trend.sessionCount} session{trend.sessionCount !== 1 ? "s" : ""}</p>
                    {modelEntries.map((e) => (
                      <p key={e.model} className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-sm ${getModelColor(e.model, e.idx)}`} />
                        {e.model}: {formatCost(e.cost)}
                      </p>
                    ))}
                    {overlay && overlay.originalCost > trend.totalCost && (
                      <p className="text-emerald-500 mt-1 border-t border-border pt-1">
                        Saved ~{formatCost(overlay.originalCost - trend.totalCost)} with routing
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                {formatCost(trend.totalCost)}
              </span>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
});
