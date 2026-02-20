"use client";

import { memo } from "react";
import { formatCost } from "@/lib/text/format";
import type { TrendBucket } from "@/features/usage/lib/trendAggregator";

/** Model color palette (oklch-aligned) */
const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4": "bg-[oklch(0.35_0.05_260)]",
  "claude-sonnet-4": "bg-[oklch(0.65_0.15_85)]",
  "claude-haiku-3.5": "bg-[oklch(0.55_0.08_200)]",
};

const FALLBACK_COLORS = [
  "bg-[oklch(0.45_0.10_300)]",
  "bg-[oklch(0.50_0.12_150)]",
  "bg-[oklch(0.60_0.10_30)]",
];

function getModelColor(model: string, idx: number): string {
  return MODEL_COLORS[model] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function formatDateLabel(date: string): string {
  // YYYY-MM-DD → "Mon DD" or "Feb 18"
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
    <div className="flex flex-col gap-1.5">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-1">
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

        return (
          <div key={trend.date} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
              {formatDateLabel(trend.date)}
            </span>
            <div className="flex-1 flex items-center">
              <div
                className="flex h-5 rounded-sm overflow-hidden"
                style={{ width: `${Math.max(widthPct, 2)}%` }}
                title={`${formatCost(trend.totalCost)} — ${trend.sessionCount} session${trend.sessionCount !== 1 ? "s" : ""}`}
              >
                {modelEntries.map((e) => {
                  const segPct = totalForBar > 0 ? (e.cost / totalForBar) * 100 : 0;
                  return (
                    <div
                      key={e.model}
                      className={`${getModelColor(e.model, e.idx)} min-w-[2px]`}
                      style={{ width: `${segPct}%` }}
                      title={`${e.model}: ${formatCost(e.cost)}`}
                    />
                  );
                })}
              </div>
            </div>
            <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
              {formatCost(trend.totalCost)}
            </span>
          </div>
        );
      })}
    </div>
  );
});
