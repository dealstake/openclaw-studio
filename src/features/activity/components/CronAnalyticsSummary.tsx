"use client";

import { memo, useMemo } from "react";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { formatDuration } from "@/lib/text/time";
import type { JobStats } from "../lib/cronStatsCalculator";

const compactNumber = new Intl.NumberFormat("en", { notation: "compact" });

export const CronAnalyticsSummary = memo(function CronAnalyticsSummary({
  jobStats,
  loading,
}: {
  jobStats: JobStats[];
  loading: boolean;
}) {
  const stats = useMemo(() => {
    const totalRuns = jobStats.reduce((s, j) => s + j.totalRuns, 0);
    const totalTokens = jobStats.reduce((s, j) => s + j.totalTokens, 0);
    const weightedSuccess =
      totalRuns > 0
        ? jobStats.reduce((s, j) => s + j.successRate * j.totalRuns, 0) / totalRuns
        : 0;
    const weightedDuration =
      totalRuns > 0
        ? jobStats.reduce((s, j) => s + j.avgDurationMs * j.totalRuns, 0) / totalRuns
        : 0;

    return { totalRuns, totalTokens, successRate: weightedSuccess, avgDuration: weightedDuration };
  }, [jobStats]);

  if (loading && jobStats.length === 0) {
    return (
      <div className="space-y-2 p-3">
        <SectionLabel>Overview</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Total Runs", value: String(stats.totalRuns) },
    { label: "Total Tokens", value: compactNumber.format(stats.totalTokens) },
    {
      label: "Success Rate",
      value: `${Math.round(stats.successRate * 100)}%`,
    },
    { label: "Avg Duration", value: formatDuration(stats.avgDuration) },
  ];

  return (
    <div className="space-y-2 p-3">
      <SectionLabel>Overview</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border bg-card p-3 shadow-sm"
          >
            <div className="text-xs text-muted-foreground">{card.label}</div>
            <div className="text-lg font-semibold text-foreground">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
});
