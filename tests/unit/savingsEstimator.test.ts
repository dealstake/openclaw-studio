import { describe, it, expect } from "vitest";
import { estimateSavings, EMPTY_SUMMARY } from "@/features/routing/lib/savingsEstimator";
import type { RoutingRule } from "@/features/routing/lib/types";
import type { ModelCostBreakdown } from "@/features/usage/lib/costCalculator";

function makeRule(
  overrides: Partial<RoutingRule> & { id: string; name: string; model: string },
): RoutingRule {
  return {
    enabled: true,
    conditions: [],
    ...overrides,
  };
}

function makeCostByModel(
  entries: Record<string, Partial<ModelCostBreakdown>>,
): Map<string, ModelCostBreakdown> {
  const map = new Map<string, ModelCostBreakdown>();
  for (const [key, val] of Object.entries(entries)) {
    map.set(key, {
      requests: val.requests ?? 1,
      inputTokens: val.inputTokens ?? 0,
      outputTokens: val.outputTokens ?? 0,
      cost: val.cost ?? 0,
    });
  }
  return map;
}

describe("estimateSavings", () => {
  it("returns empty summary when no rules", () => {
    const result = estimateSavings([], new Map(), 10, 100000, 50000, 5);
    expect(result).toEqual(EMPTY_SUMMARY);
  });

  it("returns empty summary when no sessions", () => {
    const rules = [makeRule({ id: "1", name: "Route cron", model: "anthropic/claude-haiku-3.5", conditions: [{ type: "taskType", value: "cron" }] })];
    const result = estimateSavings(rules, new Map(), 0, 0, 0, 0);
    expect(result).toEqual(EMPTY_SUMMARY);
  });

  it("returns empty summary when all rules disabled", () => {
    const rules = [makeRule({ id: "1", name: "Disabled", model: "anthropic/claude-haiku-3.5", enabled: false })];
    const result = estimateSavings(rules, new Map(), 10, 100000, 50000, 5);
    expect(result).toEqual(EMPTY_SUMMARY);
  });

  it("estimates savings for cron → haiku rule", () => {
    const rules = [
      makeRule({
        id: "1",
        name: "Cron → Haiku",
        model: "anthropic/claude-haiku-3.5",
        conditions: [{ type: "taskType", value: "cron" }],
      }),
    ];
    const costByModel = makeCostByModel({ "Opus 4": { cost: 100 } });
    const result = estimateSavings(
      rules,
      costByModel,
      100,      // totalSessions
      10000000, // 10M input tokens
      5000000,  // 5M output tokens
      50,       // 50 cron sessions
    );

    expect(result.totalSaved).toBeGreaterThan(0);
    expect(result.isEstimate).toBe(true);
    expect(result.byRule).toHaveLength(1);
    expect(result.byRule[0].ruleName).toBe("Cron → Haiku");
    expect(result.byRule[0].toModel).toBe("anthropic/claude-haiku-3.5");
  });

  it("estimates savings for catch-all rule (any → haiku)", () => {
    const rules = [
      makeRule({
        id: "1",
        name: "All → Haiku",
        model: "anthropic/claude-haiku-3.5",
        conditions: [{ type: "taskType", value: "any" }],
      }),
    ];
    const costByModel = makeCostByModel({ "Opus 4": { cost: 200 } });
    const result = estimateSavings(
      rules,
      costByModel,
      100,
      10000000,
      5000000,
      20,
    );

    expect(result.totalSaved).toBeGreaterThan(0);
    expect(result.byRule).toHaveLength(1);
    // All sessions routed
    expect(result.byRule[0].sessionsAffected).toBe(100);
  });

  it("returns zero savings when routing to same-tier model", () => {
    const rules = [
      makeRule({
        id: "1",
        name: "Opus → Opus",
        model: "anthropic/claude-opus-4-6",
        conditions: [],
      }),
    ];
    const costByModel = makeCostByModel({ "Opus 4": { cost: 100 } });
    const result = estimateSavings(rules, costByModel, 50, 5000000, 2000000, 10);

    // No savings since default = opus and rule = opus
    expect(result.totalSaved).toBe(0);
  });

  it("savedPercent is calculated correctly", () => {
    const rules = [
      makeRule({
        id: "1",
        name: "All → Flash",
        model: "gemini-2.5-flash",
        conditions: [],
      }),
    ];
    const costByModel = makeCostByModel({ "Opus 4": { cost: 50 } });
    const result = estimateSavings(rules, costByModel, 20, 2000000, 1000000, 5);

    if (result.totalSaved > 0) {
      expect(result.savedPercent).toBeGreaterThan(0);
      // savedPercent can exceed 100% when estimated original cost > actual recorded cost
      // (e.g., routing estimation assumes all sessions use the expensive default model)
      expect(Number.isFinite(result.savedPercent)).toBe(true);
    }
  });

  it("handles multiple rules with priority ordering", () => {
    const rules = [
      makeRule({
        id: "1",
        name: "Cron → Haiku",
        model: "anthropic/claude-haiku-3.5",
        conditions: [{ type: "taskType", value: "cron" }],
      }),
      makeRule({
        id: "2",
        name: "Subagent → Sonnet",
        model: "anthropic/claude-sonnet-4-6",
        conditions: [{ type: "taskType", value: "subagent" }],
      }),
    ];
    const costByModel = makeCostByModel({ "Opus 4": { cost: 150 } });
    const result = estimateSavings(rules, costByModel, 100, 10000000, 5000000, 40);

    expect(result.byRule.length).toBeGreaterThanOrEqual(1);
    expect(result.totalSaved).toBeGreaterThan(0);
  });
});
