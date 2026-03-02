/**
 * Savings Estimator — Projects potential savings from routing rules
 * using aggregated usage data (no per-session entries needed).
 *
 * Works with the data already available from useUsageQuery:
 * costByModel, cronBreakdown, agentBreakdown.
 */

import type { ModelCostBreakdown } from "@/features/usage/lib/costCalculator";
import type { RoutingRule, TaskTypeConditionValue } from "./types";
import { getModelPricing } from "@/features/usage/lib/pricingTable";

/** Per-rule savings estimate */
export type RuleSavingsEstimate = {
  ruleId: string;
  ruleName: string;
  /** Estimated sessions affected */
  sessionsAffected: number;
  /** Estimated tokens routed */
  tokensRouted: number;
  /** Cost without this rule */
  originalCost: number;
  /** Cost with this rule */
  routedCost: number;
  /** Savings from this rule */
  savedAmount: number;
  /** From model → To model */
  fromModel: string;
  toModel: string;
};

/** Aggregated savings summary */
export type SavingsEstimateSummary = {
  /** Total estimated savings across all rules */
  totalSaved: number;
  /** Total cost without routing */
  totalOriginalCost: number;
  /** Savings percentage */
  savedPercent: number;
  /** Per-rule breakdown */
  byRule: RuleSavingsEstimate[];
  /** Whether this is an estimate (rules exist but no historical tracking) */
  isEstimate: boolean;
};

const EMPTY_SUMMARY: SavingsEstimateSummary = {
  totalSaved: 0,
  totalOriginalCost: 0,
  savedPercent: 0,
  byRule: [],
  isEstimate: true,
};

/**
 * Calculate cost for given tokens with a specific model.
 */
function costForModel(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = getModelPricing(model);
  if (!pricing) return null;
  return (
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}

/**
 * Map task type conditions to session categories from usage data.
 * Returns which portion of sessions a rule would affect.
 */
function getAffectedSessions(
  taskTypes: TaskTypeConditionValue[],
  cronSessions: number,
  totalSessions: number,
  cronTokens: number,
  totalInputTokens: number,
  totalOutputTokens: number,
): { sessions: number; inputTokens: number; outputTokens: number } {
  // "any" matches everything
  if (taskTypes.includes("any") || taskTypes.length === 0) {
    return {
      sessions: totalSessions,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }

  let sessions = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const tt of taskTypes) {
    if (tt === "cron" || tt === "heartbeat") {
      // Heartbeats are a subset of cron — estimate 20% of cron for heartbeats
      const factor = tt === "heartbeat" ? 0.2 : 1;
      sessions += Math.round(cronSessions * factor);
      // Estimate token split proportionally
      const tokenFactor =
        totalSessions > 0 ? (cronSessions * factor) / totalSessions : 0;
      inputTokens += Math.round(totalInputTokens * tokenFactor);
      outputTokens += Math.round(totalOutputTokens * tokenFactor);
    } else if (tt === "main" || tt === "subagent") {
      // Non-cron sessions — estimate 50/50 split between main and subagent
      const nonCron = totalSessions - cronSessions;
      const factor = 0.5;
      sessions += Math.round(nonCron * factor);
      const nonCronTokenRatio =
        totalSessions > 0 ? (nonCron * factor) / totalSessions : 0;
      inputTokens += Math.round(totalInputTokens * nonCronTokenRatio);
      outputTokens += Math.round(totalOutputTokens * nonCronTokenRatio);
    }
  }

  return {
    sessions: Math.min(sessions, totalSessions),
    inputTokens: Math.min(inputTokens, totalInputTokens),
    outputTokens: Math.min(outputTokens, totalOutputTokens),
  };
}

/**
 * Estimate potential savings from routing rules using aggregated usage data.
 *
 * @param rules - Current routing rules
 * @param costByModel - Per-model cost breakdown from usage query
 * @param totalSessions - Total number of sessions
 * @param totalInputTokens - Total input tokens
 * @param totalOutputTokens - Total output tokens
 * @param cronSessions - Number of cron sessions (from cronBreakdown)
 * @param defaultModel - The default expensive model (used as baseline)
 */
export function estimateSavings(
  rules: RoutingRule[],
  costByModel: Map<string, ModelCostBreakdown>,
  totalSessions: number,
  totalInputTokens: number,
  totalOutputTokens: number,
  cronSessions: number,
  defaultModel: string = "anthropic/claude-opus-4-6",
): SavingsEstimateSummary {
  if (rules.length === 0 || totalSessions === 0) return EMPTY_SUMMARY;

  const enabledRules = rules.filter((r) => r.enabled && r.model);
  if (enabledRules.length === 0) return EMPTY_SUMMARY;

  // Calculate total actual cost from costByModel
  let totalOriginalCost = 0;
  for (const [, data] of costByModel) {
    totalOriginalCost += data.cost;
  }

  const byRule: RuleSavingsEstimate[] = [];
  let totalSaved = 0;

  // Track how many tokens are already "claimed" by higher-priority rules
  let claimedInputTokens = 0;
  let claimedOutputTokens = 0;

  for (const rule of enabledRules) {
    // Extract task type conditions
    const taskTypes = rule.conditions
      .filter((c) => c.type === "taskType")
      .map((c) => c.value as TaskTypeConditionValue);

    const affected = getAffectedSessions(
      taskTypes,
      cronSessions,
      totalSessions,
      0, // cronTokens not tracked separately
      totalInputTokens - claimedInputTokens,
      totalOutputTokens - claimedOutputTokens,
    );

    if (affected.sessions === 0) continue;

    // Calculate what these tokens cost with the default model vs the routed model
    const originalCost =
      costForModel(defaultModel, affected.inputTokens, affected.outputTokens) ??
      0;
    const routedCost =
      costForModel(rule.model, affected.inputTokens, affected.outputTokens) ??
      0;
    const saved = Math.max(0, originalCost - routedCost);

    if (saved > 0) {
      totalSaved += saved;
      claimedInputTokens += affected.inputTokens;
      claimedOutputTokens += affected.outputTokens;

      byRule.push({
        ruleId: rule.id,
        ruleName: rule.name,
        sessionsAffected: affected.sessions,
        tokensRouted: affected.inputTokens + affected.outputTokens,
        originalCost,
        routedCost,
        savedAmount: saved,
        fromModel: defaultModel,
        toModel: rule.model,
      });
    }
  }

  return {
    totalSaved,
    totalOriginalCost,
    savedPercent:
      totalOriginalCost > 0 ? (totalSaved / totalOriginalCost) * 100 : 0,
    byRule,
    isEstimate: true,
  };
}

export { EMPTY_SUMMARY };
