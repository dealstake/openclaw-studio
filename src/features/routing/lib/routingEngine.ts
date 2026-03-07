/**
 * Smart Model Router — Client-Side Routing Engine.
 *
 * Evaluates routing rules against message/session metadata and determines
 * the optimal model to use. Applies model overrides via sessions.patch
 * before chat.send.
 *
 * Architecture: Rules are stored in gateway config (routing.rules).
 * Before each chat.send, Studio evaluates rules client-side and applies
 * the winning model via sessions.patch. This avoids needing gateway-side
 * routing logic while using the existing model override mechanism.
 *
 * Industry pattern: LiteLLM, Martian, and Portkey all use a similar
 * evaluate-then-route pattern. The key difference is we route at the
 * session level (sessions.patch) rather than per-request.
 */

import type { RoutingRule, RoutingCondition, TaskTypeConditionValue } from "./types";
import { getModelPricing } from "@/features/usage/lib/pricingTable";

// ── Rule Evaluation ─────────────────────────────────────────────────

/**
 * Context provided to the routing engine for rule evaluation.
 * Gathered from the session/agent state before each message send.
 */
export interface RoutingContext {
  /** Agent ID of the current session */
  agentId: string;
  /** Session type: main, cron, subagent, heartbeat */
  taskType: TaskTypeConditionValue;
  /** Currently configured model (before routing) */
  configuredModel: string;
  /** Estimated input tokens for this message (optional, for future cost routing) */
  estimatedTokens?: number;
}

/**
 * Result of routing evaluation.
 */
export interface RoutingDecision {
  /** Whether routing changed the model */
  routed: boolean;
  /** The model to actually use */
  model: string;
  /** The model that was configured before routing (for savings calculation) */
  originalModel: string;
  /** The rule that matched, if any */
  matchedRule: RoutingRule | null;
  /** Reason string for logging */
  reason: string;
}

/**
 * Evaluate a single condition against the routing context.
 */
function evaluateCondition(
  condition: RoutingCondition,
  context: RoutingContext,
): boolean {
  switch (condition.type) {
    case "taskType":
      return condition.value === "any" || condition.value === context.taskType;
    case "agentId":
      return condition.value === "*" || condition.value === context.agentId;
    default:
      return false;
  }
}

/**
 * Evaluate all rules and return the first matching rule's model.
 * Rules are evaluated in order — first match wins (priority by position).
 *
 * @param rules - Routing rules (ordered by priority)
 * @param context - Current session/message context
 * @returns Routing decision with the model to use
 */
export function evaluateRoutingRules(
  rules: RoutingRule[],
  context: RoutingContext,
): RoutingDecision {
  for (const rule of rules) {
    // Skip disabled rules
    if (!rule.enabled) continue;

    // Skip rules with no target model
    if (!rule.model) continue;

    // Evaluate all conditions (AND logic — all must match)
    const allMatch =
      rule.conditions.length === 0 || // Empty conditions = match all
      rule.conditions.every((c) => evaluateCondition(c, context));

    if (allMatch) {
      const routed = rule.model !== context.configuredModel;
      return {
        routed,
        model: rule.model,
        originalModel: context.configuredModel,
        matchedRule: rule,
        reason: routed
          ? `Rule "${rule.name}" routed ${context.configuredModel} → ${rule.model}`
          : `Rule "${rule.name}" matched but model unchanged (${rule.model})`,
      };
    }
  }

  // No rule matched — use configured model
  return {
    routed: false,
    model: context.configuredModel,
    originalModel: context.configuredModel,
    matchedRule: null,
    reason: "No routing rule matched — using configured model",
  };
}

// ── Cost Calculation ────────────────────────────────────────────────

/**
 * Calculate cost for a given model and token count.
 * Uses the shared pricing table from @/features/usage/lib/pricingTable.
 */
export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number | null {
  const pricing = getModelPricing(model);
  if (!pricing) return null;
  return (tokensIn * pricing.inputPer1M + tokensOut * pricing.outputPer1M) / 1_000_000;
}

/**
 * Calculate savings from a routing decision.
 */
export function calculateSavings(
  decision: RoutingDecision,
  tokensIn: number,
  tokensOut: number,
): { originalCost: number; routedCost: number; savedAmount: number; savedPercent: number } | null {
  const originalCost = calculateCost(decision.originalModel, tokensIn, tokensOut);
  const routedCost = calculateCost(decision.model, tokensIn, tokensOut);
  if (originalCost == null || routedCost == null) return null;
  const savedAmount = originalCost - routedCost;
  const savedPercent = originalCost > 0 ? (savedAmount / originalCost) * 100 : 0;
  return { originalCost, routedCost, savedAmount, savedPercent };
}
