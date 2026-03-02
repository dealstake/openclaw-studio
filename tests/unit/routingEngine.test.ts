import { describe, it, expect } from "vitest";
import {
  evaluateRoutingRules,
  calculateCost,
  calculateSavings,
  type RoutingContext,
} from "@/features/routing/lib/routingEngine";
import type { RoutingRule } from "@/features/routing/lib/types";

const makeRule = (overrides: Partial<RoutingRule> = {}): RoutingRule => ({
  id: "rule-1",
  name: "Test Rule",
  enabled: true,
  conditions: [],
  model: "anthropic/claude-haiku-3.5",
  ...overrides,
});

const makeContext = (overrides: Partial<RoutingContext> = {}): RoutingContext => ({
  agentId: "alex",
  taskType: "cron",
  configuredModel: "anthropic/claude-opus-4-6",
  ...overrides,
});

describe("evaluateRoutingRules", () => {
  it("returns configured model when no rules exist", () => {
    const result = evaluateRoutingRules([], makeContext());
    expect(result.routed).toBe(false);
    expect(result.model).toBe("anthropic/claude-opus-4-6");
    expect(result.matchedRule).toBeNull();
  });

  it("matches rule with empty conditions (catch-all)", () => {
    const rules = [makeRule({ conditions: [] })];
    const result = evaluateRoutingRules(rules, makeContext());
    expect(result.routed).toBe(true);
    expect(result.model).toBe("anthropic/claude-haiku-3.5");
    expect(result.matchedRule?.id).toBe("rule-1");
  });

  it("matches taskType condition", () => {
    const rules = [
      makeRule({ conditions: [{ type: "taskType", value: "cron" }] }),
    ];
    const result = evaluateRoutingRules(rules, makeContext({ taskType: "cron" }));
    expect(result.routed).toBe(true);
    expect(result.model).toBe("anthropic/claude-haiku-3.5");
  });

  it("does not match wrong taskType", () => {
    const rules = [
      makeRule({ conditions: [{ type: "taskType", value: "main" }] }),
    ];
    const result = evaluateRoutingRules(rules, makeContext({ taskType: "cron" }));
    expect(result.routed).toBe(false);
    expect(result.model).toBe("anthropic/claude-opus-4-6");
  });

  it("matches agentId condition", () => {
    const rules = [
      makeRule({ conditions: [{ type: "agentId", value: "alex" }] }),
    ];
    const result = evaluateRoutingRules(rules, makeContext({ agentId: "alex" }));
    expect(result.routed).toBe(true);
  });

  it("matches agentId wildcard '*'", () => {
    const rules = [
      makeRule({ conditions: [{ type: "agentId", value: "*" }] }),
    ];
    const result = evaluateRoutingRules(rules, makeContext({ agentId: "bob" }));
    expect(result.routed).toBe(true);
  });

  it("ANDs multiple conditions", () => {
    const rules = [
      makeRule({
        conditions: [
          { type: "taskType", value: "cron" },
          { type: "agentId", value: "alex" },
        ],
      }),
    ];
    // Both match
    expect(evaluateRoutingRules(rules, makeContext({ taskType: "cron", agentId: "alex" })).routed).toBe(true);
    // One fails
    expect(evaluateRoutingRules(rules, makeContext({ taskType: "cron", agentId: "bob" })).routed).toBe(false);
  });

  it("first match wins (priority order)", () => {
    const rules = [
      makeRule({ id: "r1", name: "First", model: "anthropic/claude-haiku-3.5", conditions: [] }),
      makeRule({ id: "r2", name: "Second", model: "anthropic/claude-sonnet-4-6", conditions: [] }),
    ];
    const result = evaluateRoutingRules(rules, makeContext());
    expect(result.matchedRule?.id).toBe("r1");
    expect(result.model).toBe("anthropic/claude-haiku-3.5");
  });

  it("skips disabled rules", () => {
    const rules = [
      makeRule({ id: "r1", enabled: false, conditions: [] }),
      makeRule({ id: "r2", model: "anthropic/claude-sonnet-4-6", conditions: [] }),
    ];
    const result = evaluateRoutingRules(rules, makeContext());
    expect(result.matchedRule?.id).toBe("r2");
  });

  it("reports routed=false when matched model equals configured", () => {
    const rules = [
      makeRule({ model: "anthropic/claude-opus-4-6", conditions: [] }),
    ];
    const result = evaluateRoutingRules(rules, makeContext({ configuredModel: "anthropic/claude-opus-4-6" }));
    expect(result.routed).toBe(false);
    expect(result.matchedRule).not.toBeNull();
  });

  it("taskType 'any' matches all task types", () => {
    const rules = [
      makeRule({ conditions: [{ type: "taskType", value: "any" }] }),
    ];
    expect(evaluateRoutingRules(rules, makeContext({ taskType: "main" })).routed).toBe(true);
    expect(evaluateRoutingRules(rules, makeContext({ taskType: "heartbeat" })).routed).toBe(true);
  });
});

describe("calculateCost", () => {
  it("calculates opus cost correctly", () => {
    // Opus: $15/1M in, $75/1M out
    const cost = calculateCost("anthropic/claude-opus-4-6", 1_000_000, 100_000);
    expect(cost).toBeCloseTo(15 + 7.5);
  });

  it("calculates haiku cost correctly", () => {
    // Haiku: $0.8/1M in, $4/1M out
    const cost = calculateCost("anthropic/claude-3-5-haiku-latest", 1_000_000, 100_000);
    expect(cost).toBeCloseTo(0.8 + 0.4);
  });

  it("returns null for unknown models", () => {
    expect(calculateCost("openai/gpt-4o", 1000, 1000)).toBeNull();
  });
});

describe("calculateSavings", () => {
  it("calculates savings from opus→haiku routing", () => {
    const decision = {
      routed: true,
      model: "anthropic/claude-3-5-haiku-latest",
      originalModel: "anthropic/claude-opus-4-6",
      matchedRule: null,
      reason: "",
    };
    const result = calculateSavings(decision, 1_000_000, 100_000);
    expect(result).not.toBeNull();
    expect(result!.savedAmount).toBeGreaterThan(0);
    expect(result!.savedPercent).toBeGreaterThan(90);
  });

  it("returns null when model pricing unknown", () => {
    const decision = {
      routed: true,
      model: "unknown/model",
      originalModel: "anthropic/claude-opus-4-6",
      matchedRule: null,
      reason: "",
    };
    expect(calculateSavings(decision, 1000, 1000)).toBeNull();
  });
});
