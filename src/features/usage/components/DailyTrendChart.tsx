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

/** Model color palette using semantic chart tokens */
const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4": "bg-chart-1",
  "claude-sonnet-4": "bg-chart-2",
  "claude-haiku-3.5": "bg-chart-3",
};

const FALLBACK_COLORS = [
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-3",
];

function getModelColor(model: string, idx: number): string {
  return MODEL_COLORS[model] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function formatDateLabel(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface DailyTrendChartProps {
  trends: TrendBucket[];
  models: string[];
}

export const DailyTrendChart = memo(function DailyTrendChart({
  trends,
  models,
}: DailyTrendChartProps) {
  if (trends.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No data for this time range.</p>
    );
  }

  const maxCost = Math.max(...trends.map((t) => t.totalCost), 0.01);

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

          return (
            <div key={trend.date} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                {formatDateLabel(trend.date)}
              </span>
              <div className="flex-1 flex items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex h-5 rounded-sm overflow-hidden cursor-default"
                      style={{ width: `${Math.max(widthPct, 2)}%` }}
                      role="graphics-symbol"
                      aria-label={barLabel}
                    >
                      {modelEntries.map((e) => {
                        const segPct = totalForBar > 0 ? (e.cost / totalForBar) * 100 : 0;
                        return (
                          <div
                            key={e.model}
                            className={`${getModelColor(e.model, e.idx)} min-w-[2px]`}
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
