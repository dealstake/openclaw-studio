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
  filterByTimeRange,
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
  cachedAt: string;
};

// ─── Cache ──────────────────────────────────────────────────────────────────

type CacheEntry = {
  data: UsageQueryResponse;
  expiry: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function getCacheKey(body: RequestBody): string {
  return `${body.from ?? ""}|${body.to ?? ""}|${body.groupBy ?? ""}|${body.agentId ?? ""}`;
}

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

function computeTimeRange(
  from?: string,
  to?: string,
): "today" | "7d" | "30d" | "all" {
  if (!from && !to) return "all";
  if (!from) return "all";
  const fromMs = new Date(from).getTime();
  const now = Date.now();
  const diffDays = (now - fromMs) / (24 * 60 * 60 * 1000);
  if (diffDays <= 1) return "today";
  if (diffDays <= 7) return "7d";
  if (diffDays <= 30) return "30d";
  return "all";
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    // Check cache
    const cacheKey = getCacheKey(body);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data);
    }

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

    // Apply time range filter
    const timeRange = computeTimeRange(body.from, body.to);
    const filtered = filterByTimeRange(entries, timeRange);

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
      cachedAt: new Date().toISOString(),
    };

    // Store in cache
    cache.set(cacheKey, { data: response, expiry: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to query usage data.";
    console.error("[usage/query POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
