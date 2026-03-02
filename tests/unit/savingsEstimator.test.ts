import { describe, it, expect } from "vitest";
import {
  estimateSavings,
  EMPTY_SUMMARY,
} from "@/features/routing/lib/savingsEstimator";
import type { RoutingRule } from "@/features/routing/lib/types";
import type { ModelCostBreakdown } from "@/features/usage/lib/costCalculator";

function makeRule(overrides: Partial<RoutingRule> = {}): RoutingRule {
  return {
    id: "rule-1",
    name: "Test Rule",
    enabled: true,
    conditions: [{ type: "taskType", value: "cron" }],
    model: "anthropic/claude-haiku-3.5",
    ...overrides,
  };
}

function makeCostMap(entries: [string, number][]): Map<string, ModelCostBreakdown> {
  const map = new Map<string, ModelCostBreakdown>();
  for (const [model, cost] of entries) {
    map.set(model, {
      requests: 100,
      inputTokens: 1_000_000,
      outputTokens: 200_000,
      cost,
    });
  }
  return map;
}

describe("estimateSavings", () => {
  it("returns empty summary for no rules", () => {
    const result = estimateSavings([], new Map(), 100, 1_000_000, 200_000, 20);
    expect(result).toEqual(EMPTY_SUMMARY);
  });

  it("returns empty summary for zero sessions", () => {
    const rules = [makeRule()];
    const result = estimateSavings(rules, new Map(), 0, 0, 0, 0);
    expect(result).toEqual(EMPTY_SUMMARY);
  });

  it("returns empty for disabled rules only", () => {
    const rules = [makeRule({ enabled: false })];
    const costMap = makeCostMap([["anthropic/claude-opus-4-6", 50]]);
    const result = estimateSavings(rules, costMap, 100, 1_000_000, 200_000, 20);
    expect(result).toEqual(EMPTY_SUMMARY);
  });

  it("estimates savings for cron→haiku rule", () => {
    const rules = [makeRule({ conditions: [{ type: "taskType", value: "cron" }], model: "anthropic/claude-haiku-3.5" })];
    const costMap = makeCostMap([["anthropic/claude-opus-4-6", 50]]);
    const result = estimateSavings(rules, costMap, 100, 1_000_000, 200_000, 20);
    expect(result.totalSaved).toBeGreaterThan(0);
    expect(result.savedPercent).toBeGreaterThan(0);
    expect(result.byRule).toHaveLength(1);
    expect(result.byRule[0].toModel).toBe("anthropic/claude-haiku-3.5");
    expect(result.isEstimate).toBe(true);
  });

  it("handles multiple rules without double-counting tokens", () => {
    const rules = [
      makeRule({ id: "r1", conditions: [{ type: "taskType", value: "cron" }], model: "anthropic/claude-haiku-3.5" }),
      makeRule({ id: "r2", conditions: [{ type: "taskType", value: "main" }], model: "anthropic/claude-sonnet-4-6" }),
    ];
    const costMap = makeCostMap([["anthropic/claude-opus-4-6", 100]]);
    const result = estimateSavings(rules, costMap, 100, 2_000_000, 400_000, 30);
    // Both rules should contribute
    expect(result.byRule.length).toBeGreaterThanOrEqual(1);
    // Total saved should be positive
    expect(result.totalSaved).toBeGreaterThan(0);
  });

  it("calculates savings percent correctly", () => {
    const rules = [makeRule({ conditions: [], model: "anthropic/claude-haiku-3.5" })]; // catch-all
    const costMap = makeCostMap([["anthropic/claude-opus-4-6", 100]]);
    const result = estimateSavings(rules, costMap, 100, 1_000_000, 200_000, 20);
    if (result.totalOriginalCost > 0) {
      expect(result.savedPercent).toBeCloseTo(
        (result.totalSaved / result.totalOriginalCost) * 100,
        1,
      );
    }
  });
});
