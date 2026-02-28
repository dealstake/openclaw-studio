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
}

export const AgentCostTable = memo(function AgentCostTable({
  entries,
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
            <th
              scope="col"
              className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer select-none"
              onClick={() => handleSort("agentId")}
            >
              Agent{sortIndicator("agentId")}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right font-medium text-muted-foreground cursor-pointer select-none"
              onClick={() => handleSort("sessions")}
            >
              Sessions{sortIndicator("sessions")}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right font-medium text-muted-foreground cursor-pointer select-none"
              onClick={() => handleSort("totalTokens")}
            >
              Tokens{sortIndicator("totalTokens")}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right font-medium text-muted-foreground cursor-pointer select-none"
              onClick={() => handleSort("totalCost")}
            >
              Total{sortIndicator("totalCost")}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right font-medium text-muted-foreground cursor-pointer select-none"
              onClick={() => handleSort("avgCost")}
            >
              Avg/Session{sortIndicator("avgCost")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g) => (
            <tr key={g.agentId} className="border-b border-border/50 last:border-0">
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
