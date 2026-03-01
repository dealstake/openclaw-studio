"use client";

import { memo, useMemo, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { formatTokens, formatCost } from "@/lib/text/format";
import type { SessionCostEntry } from "@/features/usage/lib/costCalculator";
import type { AgentBreakdown } from "@/features/usage/hooks/useUsageQuery";

/**
 * Extract agent ID from session key.
 * Session keys follow: `agent:<agentId>:<sessionId>` or `cron-<uuid>-<ts>`.
 * Non-agent sessions (no "agent:" prefix) are grouped under "(direct)".
 */
function extractAgentId(key: string): string {
  if (key.startsWith("agent:")) {
    const parts = key.split(":");
    if (parts.length >= 2 && parts[1]) return parts[1];
  }
  if (key.startsWith("cron-")) return "(cron)";
  return "(direct)";
}

type AgentGroup = {
  agentId: string;
  sessions: number;
  totalCost: number;
  totalTokens: number;
  avgCost: number;
};

type SortKey = "agentId" | "sessions" | "totalCost" | "totalTokens" | "avgCost";

interface AgentCostTableProps {
  /**
   * Raw session entries for client-side aggregation.
   * Used when server-side breakdown is not available.
   */
  entries?: SessionCostEntry[];
  /**
   * Pre-aggregated server-side breakdown.
   * When provided, skips client-side aggregation of `entries`.
   */
  serverGroups?: AgentBreakdown[];
  /** Called when an agent row is clicked. */
  onAgentClick?: (agentId: string) => void;
}

export const AgentCostTable = memo(function AgentCostTable({
  entries,
  serverGroups,
  onAgentClick,
}: AgentCostTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalCost");
  const [sortAsc, setSortAsc] = useState(false);

  // If serverGroups is provided, map it to AgentGroup directly
  const groups = useMemo<AgentGroup[]>(() => {
    if (serverGroups) {
      return serverGroups.map((g) => ({
        agentId: g.agentId,
        sessions: g.sessions,
        totalCost: g.cost,
        totalTokens: g.inputTokens + g.outputTokens,
        avgCost: g.sessions > 0 ? g.cost / g.sessions : 0,
      }));
    }

    // Fall back to client-side aggregation from entries
    const map = new Map<string, AgentGroup>();
    for (const entry of entries ?? []) {
      const agentId = extractAgentId(entry.key);
      const existing = map.get(agentId);
      if (existing) {
        existing.sessions += 1;
        existing.totalCost += entry.cost ?? 0;
        existing.totalTokens += entry.inputTokens + entry.outputTokens;
        existing.avgCost = existing.totalCost / existing.sessions;
      } else {
        map.set(agentId, {
          agentId,
          sessions: 1,
          totalCost: entry.cost ?? 0,
          totalTokens: entry.inputTokens + entry.outputTokens,
          avgCost: entry.cost ?? 0,
        });
      }
    }
    return Array.from(map.values());
  }, [serverGroups, entries]);

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...groups].sort((a, b) => {
      if (sortKey === "agentId") return dir * a.agentId.localeCompare(b.agentId);
      return dir * (a[sortKey] - b[sortKey]);
    });
  }, [groups, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (sorted.length === 0) return null;

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />) : null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {(
              [
                ["agentId", "Agent", "text-left"],
                ["sessions", "Sessions", "text-right"],
                ["totalTokens", "Tokens", "text-right"],
                ["totalCost", "Total", "text-right"],
                ["avgCost", "Avg/Session", "text-right"],
              ] as const
            ).map(([key, label, align]) => (
              <th
                key={key}
                scope="col"
                className={`px-3 py-3 font-medium text-foreground/80 ${align}`}
                aria-sort={sortKey === key ? (sortAsc ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  className={`flex w-full items-center gap-0.5 bg-transparent border-0 p-0 font-medium text-inherit cursor-pointer select-none hover:text-foreground transition-colors ${align === "text-right" ? "justify-end" : "justify-start"}`}
                  onClick={() => handleSort(key as SortKey)}
                >
                  {label}{sortIndicator(key as SortKey)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((g) => (
            <tr
              key={g.agentId}
              className={`border-b border-border/50 last:border-0 ${onAgentClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
              onClick={onAgentClick ? () => onAgentClick(g.agentId) : undefined}
              role={onAgentClick ? "button" : undefined}
              tabIndex={onAgentClick ? 0 : undefined}
              onKeyDown={onAgentClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAgentClick(g.agentId); } } : undefined}
            >
              <td className="px-3 py-3 font-medium text-foreground">{g.agentId}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{g.sessions}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">
                {formatTokens(g.totalTokens)}
              </td>
              <td className="px-3 py-3 text-right text-foreground">{formatCost(g.totalCost)}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">
                {formatCost(g.avgCost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
