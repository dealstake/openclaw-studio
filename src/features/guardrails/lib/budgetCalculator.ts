/**
 * Guardrails — Budget Calculator.
 *
 * Pure cost/budget utility functions with no React imports.
 * Reuses the existing pricing table from the usage feature.
 */

import { getModelPricing } from "@/features/usage/lib/pricingTable";
import { DEFAULT_BUDGET_RULES } from "./types";
import type { BudgetRules, BudgetStatusEntry, GuardrailConfig } from "./types";

// ── Cost Estimation ───────────────────────────────────────────────────────────

/**
 * Estimate the cost of a single request in USD.
 * Returns null when the model is not in the pricing table.
 *
 * @param inputTokens  Number of input tokens.
 * @param outputTokens Number of output tokens.
 * @param model        Model identifier (e.g. "claude-opus-4", "anthropic/claude-sonnet-4").
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number | null {
  const pricing = getModelPricing(model);
  if (!pricing) return null;
  return (
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}

/**
 * Estimate the combined cost for multiple sessions.
 * Sessions with unknown models are skipped (not counted toward total).
 *
 * @param sessions Array of {inputTokens, outputTokens, model} objects.
 * @returns        Total estimated cost in USD.
 */
export function estimateTotalCost(
  sessions: Array<{ inputTokens?: number; outputTokens?: number; model?: string }>,
): number {
  let total = 0;
  for (const s of sessions) {
    const cost = estimateCost(s.inputTokens ?? 0, s.outputTokens ?? 0, s.model ?? "");
    if (cost !== null) total += cost;
  }
  return total;
}

// ── Budget Status ─────────────────────────────────────────────────────────────

/**
 * Compute a typed BudgetStatusEntry for a single budget dimension.
 * Returns null when no limit is configured (i.e. limit is 0 or undefined).
 *
 * @param used   Current usage value (tokens or USD).
 * @param limit  Budget limit. Falsy → returns null (no limit configured).
 * @param rules  Threshold rules to apply (defaults to DEFAULT_BUDGET_RULES).
 */
export function computeBudgetStatus(
  used: number,
  limit: number | undefined,
  rules?: BudgetRules,
): BudgetStatusEntry | null {
  if (!limit || limit <= 0) return null;

  const r = rules ?? DEFAULT_BUDGET_RULES;
  // Use Math.floor so e.g. 799/1000 = 79% (not 80%) — accurate boundary semantics.
  const percentUsed = Math.min(100, Math.floor((used / limit) * 100));
  const isWarning = percentUsed >= r.warnThresholdPercent;
  const isExceeded = used >= limit;

  return { used, limit, percentUsed, isWarning, isExceeded };
}

/**
 * Compute the percentage used for a budget.
 * Capped to [0, 100].
 *
 * @param used  Current usage.
 * @param limit Budget limit.
 */
export function getBudgetPercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.floor((used / limit) * 100));
}

/**
 * Return true when usage has reached or exceeded the configured warn threshold.
 *
 * @param used   Current usage.
 * @param limit  Budget limit.
 * @param rules  Threshold rules (uses DEFAULT_BUDGET_RULES when omitted).
 */
export function isBudgetWarning(
  used: number,
  limit: number,
  rules?: BudgetRules,
): boolean {
  if (limit <= 0) return false;
  const r = rules ?? DEFAULT_BUDGET_RULES;
  return getBudgetPercent(used, limit) >= r.warnThresholdPercent;
}

/**
 * Return true when usage has reached or exceeded the budget limit (100%).
 */
export function isBudgetExceeded(used: number, limit: number): boolean {
  if (limit <= 0) return false;
  return used >= limit;
}

// ── Config Parsing ────────────────────────────────────────────────────────────

/**
 * Parse a raw guardrail config value from `config.agents.list[].guardrails`.
 * Returns the default config when the value is missing or malformed.
 */
export function parseGuardrailConfig(raw: unknown): GuardrailConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { enabled: false };
  }
  const obj = raw as Record<string, unknown>;
  const enabled = obj.enabled === true;
  const dailyTokenBudget =
    typeof obj.dailyTokenBudget === "number" && obj.dailyTokenBudget > 0
      ? obj.dailyTokenBudget
      : undefined;
  const perSessionTokenBudget =
    typeof obj.perSessionTokenBudget === "number" && obj.perSessionTokenBudget > 0
      ? obj.perSessionTokenBudget
      : undefined;
  const dailyCostCapUsd =
    typeof obj.dailyCostCapUsd === "number" && obj.dailyCostCapUsd > 0
      ? obj.dailyCostCapUsd
      : undefined;

  let rules: BudgetRules | undefined;
  if (obj.rules && typeof obj.rules === "object" && !Array.isArray(obj.rules)) {
    const r = obj.rules as Record<string, unknown>;
    rules = {
      warnThresholdPercent:
        typeof r.warnThresholdPercent === "number"
          ? Math.min(100, Math.max(0, r.warnThresholdPercent))
          : DEFAULT_BUDGET_RULES.warnThresholdPercent,
      action: r.action === "pause" ? "pause" : "warn",
    };
  }

  return { enabled, dailyTokenBudget, perSessionTokenBudget, dailyCostCapUsd, rules };
}

/**
 * Serialize a GuardrailConfig to a plain JSON-safe object for config.patch.
 * Omits undefined fields to keep the stored config minimal.
 */
export function serializeGuardrailConfig(config: GuardrailConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { enabled: config.enabled };
  if (config.dailyTokenBudget !== undefined) out.dailyTokenBudget = config.dailyTokenBudget;
  if (config.perSessionTokenBudget !== undefined) out.perSessionTokenBudget = config.perSessionTokenBudget;
  if (config.dailyCostCapUsd !== undefined) out.dailyCostCapUsd = config.dailyCostCapUsd;
  if (config.rules) out.rules = config.rules;
  return out;
}
