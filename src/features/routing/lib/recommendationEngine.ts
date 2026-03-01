/**
 * Routing Recommendation Engine — Suggests routing rules based on usage patterns.
 *
 * Analyzes session activity data and identifies opportunities for cost savings
 * by routing certain task types to cheaper models.
 *
 * Heuristics:
 * 1. Expensive model on cron jobs → suggest cheaper model
 * 2. Heartbeat tasks using full-size model → suggest haiku
 * 3. High-frequency low-token sub-agents → suggest lighter model
 */

import type { RoutingRule } from "./types";
import { calculateCost } from "./routingEngine";
const uuidv4 = () => crypto.randomUUID();

// ── Types ───────────────────────────────────────────────────────────

export interface UsageDataPoint {
  agentId: string;
  taskType: "main" | "cron" | "subagent" | "heartbeat";
  model: string;
  tokensIn: number;
  tokensOut: number;
  count: number; // number of runs
  totalCostUsd: number;
}

export interface Recommendation {
  id: string;
  /** Severity: how much money this would save */
  priority: "high" | "medium" | "low";
  /** Human-readable title */
  title: string;
  /** Detailed explanation */
  description: string;
  /** Estimated monthly savings in USD */
  estimatedMonthlySavings: number;
  /** Pre-built rule that implements this recommendation */
  suggestedRule: RoutingRule;
}

// ── Heuristics ──────────────────────────────────────────────────────

const EXPENSIVE_MODELS = new Set([
  "anthropic/claude-opus-4-6",
]);

const CHEAP_ALTERNATIVES: Record<string, string> = {
  "anthropic/claude-opus-4-6": "anthropic/claude-sonnet-4-6",
};

const HAIKU_MODEL = "anthropic/claude-3-5-haiku-latest";

/**
 * Generate routing recommendations from usage data.
 *
 * @param data - Aggregated usage data points (e.g., last 7 days)
 * @param existingRules - Currently configured rules (to avoid duplicates)
 */
export function generateRecommendations(
  data: UsageDataPoint[],
  existingRules: RoutingRule[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const existingTaskTypes = new Set(
    existingRules.flatMap((r) =>
      r.conditions.filter((c) => c.type === "taskType").map((c) => c.value),
    ),
  );

  // Group by task type
  const byTaskType = new Map<string, UsageDataPoint[]>();
  for (const dp of data) {
    const key = dp.taskType;
    if (!byTaskType.has(key)) byTaskType.set(key, []);
    byTaskType.get(key)!.push(dp);
  }

  // Heuristic 1: Cron jobs using expensive models
  const cronData = byTaskType.get("cron") ?? [];
  const expensiveCron = cronData.filter((d) => EXPENSIVE_MODELS.has(d.model));
  if (expensiveCron.length > 0 && !existingTaskTypes.has("cron")) {
    const totalCost = expensiveCron.reduce((sum, d) => sum + d.totalCostUsd, 0);
    const totalCount = expensiveCron.reduce((sum, d) => sum + d.count, 0);
    const primaryModel = expensiveCron[0].model;
    const alternative = CHEAP_ALTERNATIVES[primaryModel] ?? HAIKU_MODEL;

    // Estimate savings (assume alternative is ~5x cheaper for opus→sonnet)
    const altTotalIn = expensiveCron.reduce((s, d) => s + d.tokensIn, 0);
    const altTotalOut = expensiveCron.reduce((s, d) => s + d.tokensOut, 0);
    const altCost = calculateCost(alternative, altTotalIn, altTotalOut) ?? totalCost * 0.2;
    const weeklySavings = totalCost - altCost;
    const monthlySavings = weeklySavings * 4.3;

    if (monthlySavings > 0.5) {
      recommendations.push({
        id: uuidv4(),
        priority: monthlySavings > 10 ? "high" : monthlySavings > 2 ? "medium" : "low",
        title: `Route cron jobs to ${alternative.split("/")[1]}`,
        description: `${totalCount} cron runs used ${primaryModel.split("/")[1]} in the last period, costing $${totalCost.toFixed(2)}. Routing to ${alternative.split("/")[1]} could save ~$${monthlySavings.toFixed(2)}/month with minimal quality impact on automated tasks.`,
        estimatedMonthlySavings: monthlySavings,
        suggestedRule: {
          id: uuidv4(),
          name: `Route cron → ${alternative.split("/")[1]}`,
          enabled: true,
          conditions: [{ type: "taskType", value: "cron" }],
          model: alternative,
        },
      });
    }
  }

  // Heuristic 2: Heartbeats using anything other than haiku
  const heartbeatData = byTaskType.get("heartbeat") ?? [];
  const expensiveHeartbeats = heartbeatData.filter(
    (d) => d.model !== HAIKU_MODEL && d.model !== "anthropic/claude-haiku-3.5",
  );
  if (expensiveHeartbeats.length > 0 && !existingTaskTypes.has("heartbeat")) {
    const totalCost = expensiveHeartbeats.reduce((sum, d) => sum + d.totalCostUsd, 0);
    const monthlySavings = totalCost * 0.9 * 4.3; // haiku is ~10% of opus cost

    if (monthlySavings > 0.1) {
      recommendations.push({
        id: uuidv4(),
        priority: "medium",
        title: "Route heartbeats to Haiku",
        description: `Heartbeat checks don't need full reasoning capability. Routing to Haiku saves ~$${monthlySavings.toFixed(2)}/month.`,
        estimatedMonthlySavings: monthlySavings,
        suggestedRule: {
          id: uuidv4(),
          name: "Route heartbeats → Haiku",
          enabled: true,
          conditions: [{ type: "taskType", value: "heartbeat" }],
          model: HAIKU_MODEL,
        },
      });
    }
  }

  // Heuristic 3: Sub-agents using expensive models with low token counts
  const subagentData = byTaskType.get("subagent") ?? [];
  const lowTokenSubagents = subagentData.filter(
    (d) =>
      EXPENSIVE_MODELS.has(d.model) &&
      d.count > 5 &&
      d.tokensIn / d.count < 10000, // avg < 10K input tokens per run
  );
  if (lowTokenSubagents.length > 0 && !existingTaskTypes.has("subagent")) {
    const totalCost = lowTokenSubagents.reduce((sum, d) => sum + d.totalCostUsd, 0);
    const alternative = "anthropic/claude-sonnet-4-6";
    const monthlySavings = totalCost * 0.8 * 4.3;

    if (monthlySavings > 1) {
      recommendations.push({
        id: uuidv4(),
        priority: monthlySavings > 5 ? "high" : "medium",
        title: "Route sub-agents to Sonnet",
        description: `Low-complexity sub-agent runs (avg <10K tokens) are using Opus. Sonnet handles these well at 80% lower cost (~$${monthlySavings.toFixed(2)}/month savings).`,
        estimatedMonthlySavings: monthlySavings,
        suggestedRule: {
          id: uuidv4(),
          name: "Route sub-agents → Sonnet",
          enabled: true,
          conditions: [{ type: "taskType", value: "subagent" }],
          model: alternative,
        },
      });
    }
  }

  // Sort by estimated savings (highest first)
  return recommendations.sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings);
}
