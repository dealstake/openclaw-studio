"use client";

import { memo, useMemo, useState } from "react";
import { formatTokens, formatCost } from "@/lib/text/format";
import type { SessionCostEntry } from "@/features/usage/lib/costCalculator";

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
  entries: SessionCostEntry[];
  /** Called when an agent row is clicked. */
  onAgentClick?: (agentId: string) => void;
}

export const AgentCostTable = memo(function AgentCostTable({
  entries,
  onAgentClick,
}: AgentCostTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalCost");
  const [sortAsc, setSortAsc] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, AgentGroup>();
    for (const entry of entries) {
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
  }, [entries]);

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
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
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
                className={`px-3 py-2 font-medium text-muted-foreground ${align}`}
                aria-sort={sortKey === key ? (sortAsc ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  className={`bg-transparent border-0 p-0 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${align}`}
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
              <td className="px-3 py-2 font-medium text-foreground">{g.agentId}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{g.sessions}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {formatTokens(g.totalTokens)}
              </td>
              <td className="px-3 py-2 text-right text-foreground">{formatCost(g.totalCost)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {formatCost(g.avgCost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
