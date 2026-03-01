"use client";

import { memo, useMemo } from "react";
import { formatTokens, formatCost } from "@/lib/text/format";
import type { SessionCostEntry } from "@/features/usage/lib/costCalculator";
import type { CronBreakdown } from "@/features/usage/hooks/useUsageQuery";

/** UUID v4 pattern: 8-4-4-4-12 hex chars */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Extract cron job ID from session key: "cron-<uuid>-<timestamp>" → uuid */
function extractCronJobId(key: string): string {
  const match = UUID_RE.exec(key);
  if (match) return match[0];
  // Fallback: strip "cron-" prefix and last segment (timestamp)
  const parts = key.split("-");
  return parts.slice(1, -1).join("-") || key;
}

type CronJobGroup = {
  jobId: string;
  runs: number;
  totalCost: number;
  totalTokens: number;
};

interface CronCostTableProps {
  /**
   * Raw session entries for client-side aggregation.
   * Used when server-side breakdown is not available.
   */
  entries?: SessionCostEntry[];
  /**
   * Pre-aggregated server-side cron breakdown.
   * When provided, skips client-side aggregation of `entries`.
   */
  serverGroups?: CronBreakdown[];
}

export const CronCostTable = memo(function CronCostTable({
  entries,
  serverGroups,
}: CronCostTableProps) {
  const groups = useMemo<CronJobGroup[]>(() => {
    if (serverGroups) {
      return serverGroups.map((g) => ({
        jobId: g.jobId,
        runs: g.runs,
        totalCost: g.cost,
        totalTokens: g.totalTokens,
      }));
    }

    // Fall back to client-side aggregation from entries
    const cronEntries = (entries ?? []).filter((e) => e.isCron);
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
  }, [serverGroups, entries]);

  if (groups.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">Job ID</th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">Runs</th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">Tokens</th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">Avg/Run</th>
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
