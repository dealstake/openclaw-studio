import { NextResponse, type NextRequest } from "next/server";

import { gatewayRpc } from "@/lib/gateway/server-rpc";
import {
  calculateSessionCosts,
  type RawSessionEntry,
  type SessionCostEntry,
  type ModelCostBreakdown,
} from "@/features/usage/lib/costCalculator";
import {
  aggregateByDay,
  type TrendBucket,
} from "@/features/usage/lib/trendAggregator";

export const runtime = "nodejs";

// ─── Types ──────────────────────────────────────────────────────────────────

type GroupBy = "agent" | "model" | "day";

type RequestBody = {
  from?: string; // ISO date
  to?: string; // ISO date
  groupBy?: GroupBy;
  agentId?: string;
};

type AgentBreakdown = {
  agentId: string;
  sessions: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
};

type UsageQueryResponse = {
  totalCost: number;
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costByModel: Record<string, ModelCostBreakdown>;
  dailyTrends: TrendBucket[];
  agentBreakdown: AgentBreakdown[];
  projectedMonthlyCost: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractAgentId(sessionKey: string): string {
  if (sessionKey.startsWith("agent:")) {
    const parts = sessionKey.split(":");
    return parts.length >= 2 && parts[1] ? parts[1] : "(direct)";
  }
  if (sessionKey.startsWith("cron-")) return "(cron)";
  return "(direct)";
}

function buildAgentBreakdown(entries: SessionCostEntry[]): AgentBreakdown[] {
  const map = new Map<string, AgentBreakdown>();
  for (const entry of entries) {
    const agentId = extractAgentId(entry.key);
    const existing = map.get(agentId);
    if (existing) {
      existing.sessions += 1;
      existing.cost += entry.cost ?? 0;
      existing.inputTokens += entry.inputTokens;
      existing.outputTokens += entry.outputTokens;
    } else {
      map.set(agentId, {
        agentId,
        sessions: 1,
        cost: entry.cost ?? 0,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

/** Filter entries by explicit from/to ISO dates (precise, no bucketing). */
function filterByDateRange(
  entries: SessionCostEntry[],
  from?: string,
  to?: string,
): SessionCostEntry[] {
  if (!from && !to) return entries;
  const fromMs = from ? new Date(from).getTime() : 0;
  const toMs = to ? new Date(to).getTime() : Date.now();
  return entries.filter(
    (e) => e.updatedAt != null && e.updatedAt >= fromMs && e.updatedAt <= toMs,
  );
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    // Fetch sessions from gateway
    const result = await gatewayRpc<{ sessions?: RawSessionEntry[] }>(
      "sessions.list",
      {
        includeGlobal: true,
        includeUnknown: true,
        limit: 2000,
      },
    );

    const raw = result.sessions ?? [];
    const { entries } = calculateSessionCosts(raw);

    // Apply time range filter (precise date-based)
    const filtered = filterByDateRange(entries, body.from, body.to);

    // Filter by agentId if specified
    const agentFiltered = body.agentId
      ? filtered.filter((e) => extractAgentId(e.key) === body.agentId)
      : filtered;

    // Aggregate
    const costByModel: Record<string, ModelCostBreakdown> = {};
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const entry of agentFiltered) {
      totalInputTokens += entry.inputTokens;
      totalOutputTokens += entry.outputTokens;
      if (entry.cost !== null) totalCost += entry.cost;

      const model = entry.modelDisplayName;
      const existing = costByModel[model];
      if (existing) {
        existing.requests += 1;
        existing.inputTokens += entry.inputTokens;
        existing.outputTokens += entry.outputTokens;
        existing.cost += entry.cost ?? 0;
      } else {
        costByModel[model] = {
          requests: 1,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          cost: entry.cost ?? 0,
        };
      }
    }

    const dailyTrends = aggregateByDay(agentFiltered);
    const agentBreakdown = buildAgentBreakdown(agentFiltered);

    // Projected monthly cost
    const projectedMonthlyCost =
      dailyTrends.length > 0
        ? (dailyTrends.reduce((s, d) => s + d.totalCost, 0) /
            dailyTrends.length) *
          30
        : 0;

    const response: UsageQueryResponse = {
      totalCost,
      totalSessions: agentFiltered.length,
      totalInputTokens,
      totalOutputTokens,
      costByModel,
      dailyTrends,
      agentBreakdown,
      projectedMonthlyCost,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to query usage data.";
    console.error("[usage/query POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
