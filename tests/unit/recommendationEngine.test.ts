import { describe, it, expect } from "vitest";
import {
  generateRecommendations,
  type UsageDataPoint,
} from "@/features/routing/lib/recommendationEngine";
import type { RoutingRule } from "@/features/routing/lib/types";

function makeDataPoint(overrides: Partial<UsageDataPoint> = {}): UsageDataPoint {
  return {
    agentId: "alex",
    taskType: "cron",
    model: "anthropic/claude-opus-4-6",
    tokensIn: 100_000,
    tokensOut: 20_000,
    count: 50,
    totalCostUsd: 3.0,
    ...overrides,
  };
}

describe("generateRecommendations", () => {
  it("returns empty array for empty data", () => {
    expect(generateRecommendations([], [], 7)).toEqual([]);
  });

  it("recommends routing cron jobs off expensive models", () => {
    const data = [makeDataPoint({ taskType: "cron", model: "anthropic/claude-opus-4-6", totalCostUsd: 10, count: 100 })];
    const recs = generateRecommendations(data, [], 7);
    expect(recs.length).toBeGreaterThanOrEqual(1);
    const cronRec = recs.find((r) => r.title.includes("cron"));
    expect(cronRec).toBeDefined();
    expect(cronRec!.suggestedRule.conditions).toEqual([{ type: "taskType", value: "cron" }]);
    expect(cronRec!.estimatedMonthlySavings).toBeGreaterThan(0);
  });

  it("recommends routing heartbeats to haiku", () => {
    const data = [
      makeDataPoint({
        taskType: "heartbeat",
        model: "anthropic/claude-opus-4-6",
        totalCostUsd: 2,
        count: 200,
      }),
    ];
    const recs = generateRecommendations(data, [], 7);
    const hbRec = recs.find((r) => r.title.includes("Haiku") || r.title.includes("heartbeat"));
    expect(hbRec).toBeDefined();
    expect(hbRec!.suggestedRule.model).toBe("anthropic/claude-3-5-haiku-latest");
  });

  it("recommends routing low-token sub-agents to sonnet", () => {
    const data = [
      makeDataPoint({
        taskType: "subagent",
        model: "anthropic/claude-opus-4-6",
        tokensIn: 30_000, // avg 30000/10 = 3000 per run (< 10K threshold)
        tokensOut: 5_000,
        count: 10,
        totalCostUsd: 5,
      }),
    ];
    const recs = generateRecommendations(data, [], 7);
    const saRec = recs.find((r) => r.title.includes("sub-agent") || r.title.includes("Sonnet"));
    expect(saRec).toBeDefined();
    expect(saRec!.suggestedRule.model).toBe("anthropic/claude-sonnet-4-6");
  });

  it("skips recommendations when rules already exist for task type", () => {
    const data = [makeDataPoint({ taskType: "cron", totalCostUsd: 10, count: 100 })];
    const existingRules: RoutingRule[] = [
      {
        id: "existing",
        name: "Existing cron rule",
        enabled: true,
        conditions: [{ type: "taskType", value: "cron" }],
        model: "anthropic/claude-sonnet-4-6",
      },
    ];
    const recs = generateRecommendations(data, existingRules, 7);
    const cronRec = recs.find((r) => r.suggestedRule.conditions.some((c) => c.type === "taskType" && c.value === "cron"));
    expect(cronRec).toBeUndefined();
  });

  it("does not recommend when savings are too low", () => {
    const data = [
      makeDataPoint({
        taskType: "heartbeat",
        model: "anthropic/claude-opus-4-6",
        totalCostUsd: 0.001, // tiny cost
        count: 1,
      }),
    ];
    const recs = generateRecommendations(data, [], 7);
    // Heartbeat threshold is $0.1/month
    const hbRec = recs.find((r) => r.title.includes("heartbeat") || r.title.includes("Haiku"));
    // With 0.001 * 0.9 / 7 * 30 = ~0.004, below $0.1 threshold
    expect(hbRec).toBeUndefined();
  });

  it("sorts recommendations by savings (highest first)", () => {
    const data = [
      makeDataPoint({ taskType: "cron", totalCostUsd: 50, count: 200 }),
      makeDataPoint({ taskType: "heartbeat", model: "anthropic/claude-opus-4-6", totalCostUsd: 2, count: 100 }),
    ];
    const recs = generateRecommendations(data, [], 7);
    if (recs.length >= 2) {
      expect(recs[0].estimatedMonthlySavings).toBeGreaterThanOrEqual(recs[1].estimatedMonthlySavings);
    }
  });

  it("does not recommend for cheap models", () => {
    const data = [
      makeDataPoint({
        taskType: "cron",
        model: "anthropic/claude-haiku-3.5",
        totalCostUsd: 0.5,
        count: 100,
      }),
    ];
    const recs = generateRecommendations(data, [], 7);
    // Haiku is not in EXPENSIVE_MODELS so no cron recommendation
    expect(recs).toEqual([]);
  });

  it("assigns high priority for large savings", () => {
    const data = [
      makeDataPoint({ taskType: "cron", totalCostUsd: 100, count: 500, tokensIn: 5_000_000, tokensOut: 1_000_000 }),
    ];
    const recs = generateRecommendations(data, [], 7);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].priority).toBe("high");
  });
});
