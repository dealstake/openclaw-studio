"use client";

import { memo, useMemo } from "react";
import type { SessionCostEntry } from "@/features/usage/lib/costCalculator";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Extract cron job ID from session key: "cron-<jobId>-<timestamp>" → jobId */
function extractCronJobId(key: string): string {
  // key format: cron-<uuid>-<timestamp>
  const parts = key.split("-");
  // UUID is parts[1..5] (5 segments), timestamp is last
  if (parts.length >= 7) {
    return parts.slice(1, 6).join("-");
  }
  // Fallback: everything between first and last dash
  return parts.slice(1, -1).join("-");
}

type CronJobGroup = {
  jobId: string;
  runs: number;
  totalCost: number;
  totalTokens: number;
};

interface CronCostTableProps {
  entries: SessionCostEntry[];
}

export const CronCostTable = memo(function CronCostTable({
  entries,
}: CronCostTableProps) {
  const cronEntries = useMemo(() => entries.filter((e) => e.isCron), [entries]);

  const groups = useMemo(() => {
    const map = new Map<string, CronJobGroup>();
    for (const entry of cronEntries) {
      const jobId = extractCronJobId(entry.key);
      const existing = map.get(jobId);
      if (existing) {
        existing.runs += 1;
        existing.totalCost += entry.cost ?? 0;
        existing.totalTokens += entry.inputTokens + entry.outputTokens;
      } else {
        map.set(jobId, {
          jobId,
          runs: 1,
          totalCost: entry.cost ?? 0,
          totalTokens: entry.inputTokens + entry.outputTokens,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [cronEntries]);

  if (groups.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Job ID</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Runs</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Tokens</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Avg/Run</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.jobId} className="border-b border-border/50 last:border-0">
              <td className="px-3 py-2 font-mono text-xs text-foreground" title={g.jobId}>
                {g.jobId.slice(0, 8)}…
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">{g.runs}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {formatTokens(g.totalTokens)}
              </td>
              <td className="px-3 py-2 text-right text-foreground">{formatCost(g.totalCost)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {formatCost(g.runs > 0 ? g.totalCost / g.runs : 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
