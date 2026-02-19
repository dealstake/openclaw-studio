import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  evaluateBudgetRule,
  evaluateCompletionRule,
  evaluateErrorRule,
  evaluateRateLimitRule,
  shouldCooldown,
} from "@/features/notifications/lib/alertEvaluator";
import type { AlertRule } from "@/features/notifications/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "test-rule",
    type: "budget",
    enabled: true,
    threshold: 100_000,
    cooldownMs: 60_000,
    label: "Test rule",
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
});

// ---------------------------------------------------------------------------
// shouldCooldown
// ---------------------------------------------------------------------------

describe("shouldCooldown", () => {
  it("returns false when rule has never fired", () => {
    const lastFired = new Map<string, number>();
    expect(shouldCooldown(makeRule(), lastFired, Date.now())).toBe(false);
  });

  it("returns true within cooldown window", () => {
    const now = Date.now();
    const lastFired = new Map([["test-rule", now - 30_000]]);
    expect(shouldCooldown(makeRule({ cooldownMs: 60_000 }), lastFired, now)).toBe(true);
  });

  it("returns false after cooldown expires", () => {
    const now = Date.now();
    const lastFired = new Map([["test-rule", now - 120_000]]);
    expect(shouldCooldown(makeRule({ cooldownMs: 60_000 }), lastFired, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateBudgetRule
// ---------------------------------------------------------------------------

describe("evaluateBudgetRule", () => {
  it("returns null when below threshold", () => {
    const rule = makeRule({ type: "budget", threshold: 500_000 });
    expect(evaluateBudgetRule(rule, 200_000)).toBeNull();
  });

  it("returns notification when at threshold", () => {
    const rule = makeRule({ type: "budget", threshold: 500_000 });
    const result = evaluateBudgetRule(rule, 500_000);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("budget");
    expect(result!.title).toBe("Token budget exceeded");
  });

  it("returns notification when above threshold", () => {
    const rule = makeRule({ type: "budget", threshold: 500_000 });
    const result = evaluateBudgetRule(rule, 750_000);
    expect(result).not.toBeNull();
  });

  it("returns null when disabled", () => {
    const rule = makeRule({ type: "budget", threshold: 500_000, enabled: false });
    expect(evaluateBudgetRule(rule, 750_000)).toBeNull();
  });

  it("returns null for wrong rule type", () => {
    const rule = makeRule({ type: "error", threshold: 500_000 });
    expect(evaluateBudgetRule(rule, 750_000)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluateCompletionRule
// ---------------------------------------------------------------------------

describe("evaluateCompletionRule", () => {
  it("returns notification for complete state", () => {
    const rule = makeRule({ type: "completion" });
    const result = evaluateCompletionRule(rule, { state: "complete", agentId: "alex" });
    expect(result).not.toBeNull();
    expect(result!.type).toBe("completion");
    expect(result!.body).toContain("alex");
  });

  it("returns notification for end state", () => {
    const rule = makeRule({ type: "completion" });
    const result = evaluateCompletionRule(rule, { state: "end", agentId: "bot" });
    expect(result).not.toBeNull();
  });

  it("returns null for non-completion states", () => {
    const rule = makeRule({ type: "completion" });
    expect(evaluateCompletionRule(rule, { state: "delta" })).toBeNull();
    expect(evaluateCompletionRule(rule, { state: "error" })).toBeNull();
    expect(evaluateCompletionRule(rule, { state: "running" })).toBeNull();
  });

  it("returns null when disabled", () => {
    const rule = makeRule({ type: "completion", enabled: false });
    expect(evaluateCompletionRule(rule, { state: "complete" })).toBeNull();
  });

  it("handles missing agentId gracefully", () => {
    const rule = makeRule({ type: "completion" });
    const result = evaluateCompletionRule(rule, { state: "complete" });
    expect(result!.body).toContain("An agent run completed");
  });
});

// ---------------------------------------------------------------------------
// evaluateErrorRule
// ---------------------------------------------------------------------------

describe("evaluateErrorRule", () => {
  it("returns null when fewer than threshold errors", () => {
    const rule = makeRule({ type: "error", threshold: 3, cooldownMs: 300_000 });
    const now = Date.now();
    const errors = [{ timestamp: now - 1000 }, { timestamp: now - 2000 }];
    expect(evaluateErrorRule(rule, errors)).toBeNull();
  });

  it("returns notification when threshold reached in window", () => {
    const rule = makeRule({ type: "error", threshold: 3, cooldownMs: 300_000 });
    const now = Date.now();
    const errors = [
      { timestamp: now - 1000 },
      { timestamp: now - 2000 },
      { timestamp: now - 3000 },
    ];
    const result = evaluateErrorRule(rule, errors);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("error");
    expect(result!.title).toBe("Error spike detected");
  });

  it("ignores errors outside the time window", () => {
    const rule = makeRule({ type: "error", threshold: 3, cooldownMs: 300_000 });
    const now = Date.now();
    const errors = [
      { timestamp: now - 1000 },
      { timestamp: now - 2000 },
      { timestamp: now - 600_000 }, // outside 5-min window
    ];
    expect(evaluateErrorRule(rule, errors)).toBeNull();
  });

  it("returns null when disabled", () => {
    const rule = makeRule({ type: "error", threshold: 1, enabled: false });
    expect(evaluateErrorRule(rule, [{ timestamp: Date.now() }])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluateRateLimitRule
// ---------------------------------------------------------------------------

describe("evaluateRateLimitRule", () => {
  it("returns null when below threshold", () => {
    const rule = makeRule({ type: "rateLimit", threshold: 80 });
    expect(evaluateRateLimitRule(rule, 50)).toBeNull();
  });

  it("returns notification at threshold", () => {
    const rule = makeRule({ type: "rateLimit", threshold: 80 });
    const result = evaluateRateLimitRule(rule, 80);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("rateLimit");
  });

  it("returns notification above threshold", () => {
    const rule = makeRule({ type: "rateLimit", threshold: 80 });
    const result = evaluateRateLimitRule(rule, 95);
    expect(result).not.toBeNull();
    expect(result!.body).toContain("95%");
  });

  it("returns null when disabled", () => {
    const rule = makeRule({ type: "rateLimit", threshold: 80, enabled: false });
    expect(evaluateRateLimitRule(rule, 95)).toBeNull();
  });
});
