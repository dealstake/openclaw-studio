import { describe, it, expect } from "vitest";
import {
  estimateCost,
  estimateTotalCost,
  computeBudgetStatus,
  getBudgetPercent,
  isBudgetWarning,
  isBudgetExceeded,
  parseGuardrailConfig,
  serializeGuardrailConfig,
} from "@/features/guardrails/lib/budgetCalculator";
import type { GuardrailConfig } from "@/features/guardrails/lib/types";

// ── estimateCost ─────────────────────────────────────────────────────────────

describe("estimateCost", () => {
  it("calculates cost for a known Opus model", () => {
    // 1M input * $15/1M + 100K output * $75/1M = $15 + $7.50 = $22.50
    expect(estimateCost(1_000_000, 100_000, "claude-opus-4")).toBeCloseTo(22.5);
  });

  it("calculates cost for a known Sonnet model", () => {
    // 500K input * $3/1M + 200K output * $15/1M = $1.50 + $3.00 = $4.50
    expect(estimateCost(500_000, 200_000, "claude-sonnet-4")).toBeCloseTo(4.5);
  });

  it("handles provider-prefixed model ids", () => {
    const withPrefix = estimateCost(1_000_000, 0, "anthropic/claude-opus-4");
    const withoutPrefix = estimateCost(1_000_000, 0, "claude-opus-4");
    expect(withPrefix).toBeCloseTo(withoutPrefix ?? 0);
  });

  it("returns null for unknown model", () => {
    expect(estimateCost(1000, 500, "gpt-unknown-xyz")).toBeNull();
  });

  it("handles zero tokens", () => {
    expect(estimateCost(0, 0, "claude-opus-4")).toBeCloseTo(0);
  });
});

// ── estimateTotalCost ─────────────────────────────────────────────────────────

describe("estimateTotalCost", () => {
  it("sums costs across multiple sessions", () => {
    const sessions = [
      { inputTokens: 1_000_000, outputTokens: 0, model: "claude-opus-4" }, // $15
      { inputTokens: 1_000_000, outputTokens: 0, model: "claude-sonnet-4" }, // $3
    ];
    expect(estimateTotalCost(sessions)).toBeCloseTo(18);
  });

  it("skips sessions with unknown models", () => {
    const sessions = [
      { inputTokens: 1_000_000, outputTokens: 0, model: "gpt-99" },
      { inputTokens: 1_000_000, outputTokens: 0, model: "claude-opus-4" },
    ];
    expect(estimateTotalCost(sessions)).toBeCloseTo(15);
  });

  it("handles empty array", () => {
    expect(estimateTotalCost([])).toBe(0);
  });

  it("handles missing token fields (treats as 0)", () => {
    const sessions = [{ model: "claude-opus-4" }];
    expect(estimateTotalCost(sessions)).toBeCloseTo(0);
  });
});

// ── computeBudgetStatus ───────────────────────────────────────────────────────

describe("computeBudgetStatus", () => {
  it("returns null when limit is 0", () => {
    expect(computeBudgetStatus(100, 0)).toBeNull();
  });

  it("returns null when limit is undefined", () => {
    expect(computeBudgetStatus(100, undefined)).toBeNull();
  });

  it("computes correct percent used", () => {
    const status = computeBudgetStatus(500, 1000);
    expect(status?.percentUsed).toBe(50);
  });

  it("caps percentUsed at 100 when usage exceeds limit", () => {
    const status = computeBudgetStatus(1500, 1000);
    expect(status?.percentUsed).toBe(100);
  });

  it("marks isWarning true when usage >= warnThresholdPercent", () => {
    const rules = { warnThresholdPercent: 80, action: "warn" as const };
    expect(computeBudgetStatus(800, 1000, rules)?.isWarning).toBe(true);
    expect(computeBudgetStatus(799, 1000, rules)?.isWarning).toBe(false);
  });

  it("marks isExceeded true when usage >= limit", () => {
    expect(computeBudgetStatus(1000, 1000)?.isExceeded).toBe(true);
    expect(computeBudgetStatus(999, 1000)?.isExceeded).toBe(false);
  });

  it("uses DEFAULT_BUDGET_RULES when rules omitted", () => {
    // Default warnThresholdPercent = 80
    expect(computeBudgetStatus(800, 1000)?.isWarning).toBe(true);
    expect(computeBudgetStatus(799, 1000)?.isWarning).toBe(false);
  });

  it("returns all fields correctly for a typical mid-range usage", () => {
    const status = computeBudgetStatus(400, 1000);
    expect(status).toEqual({
      used: 400,
      limit: 1000,
      percentUsed: 40,
      isWarning: false,
      isExceeded: false,
    });
  });
});

// ── getBudgetPercent ──────────────────────────────────────────────────────────

describe("getBudgetPercent", () => {
  it("returns 0 when limit is 0", () => {
    expect(getBudgetPercent(100, 0)).toBe(0);
  });

  it("returns correct percentage", () => {
    expect(getBudgetPercent(250, 1000)).toBe(25);
  });

  it("caps at 100 when over budget", () => {
    expect(getBudgetPercent(2000, 1000)).toBe(100);
  });
});

// ── isBudgetWarning ───────────────────────────────────────────────────────────

describe("isBudgetWarning", () => {
  it("returns false when limit is 0", () => {
    expect(isBudgetWarning(100, 0)).toBe(false);
  });

  it("returns true when usage is at or above threshold", () => {
    const rules = { warnThresholdPercent: 75, action: "warn" as const };
    expect(isBudgetWarning(750, 1000, rules)).toBe(true);
    expect(isBudgetWarning(751, 1000, rules)).toBe(true);
  });

  it("returns false when usage is below threshold", () => {
    const rules = { warnThresholdPercent: 75, action: "warn" as const };
    expect(isBudgetWarning(749, 1000, rules)).toBe(false);
  });
});

// ── isBudgetExceeded ──────────────────────────────────────────────────────────

describe("isBudgetExceeded", () => {
  it("returns false when limit is 0", () => {
    expect(isBudgetExceeded(100, 0)).toBe(false);
  });

  it("returns true when usage equals limit", () => {
    expect(isBudgetExceeded(1000, 1000)).toBe(true);
  });

  it("returns true when usage exceeds limit", () => {
    expect(isBudgetExceeded(1001, 1000)).toBe(true);
  });

  it("returns false when usage is below limit", () => {
    expect(isBudgetExceeded(999, 1000)).toBe(false);
  });
});

// ── parseGuardrailConfig ──────────────────────────────────────────────────────

describe("parseGuardrailConfig", () => {
  it("returns disabled config for null/undefined input", () => {
    expect(parseGuardrailConfig(null)).toEqual({ enabled: false });
    expect(parseGuardrailConfig(undefined)).toEqual({ enabled: false });
  });

  it("returns disabled config for non-object input", () => {
    expect(parseGuardrailConfig("string")).toEqual({ enabled: false });
    expect(parseGuardrailConfig(42)).toEqual({ enabled: false });
  });

  it("parses enabled flag", () => {
    expect(parseGuardrailConfig({ enabled: true })).toMatchObject({ enabled: true });
    expect(parseGuardrailConfig({ enabled: false })).toMatchObject({ enabled: false });
  });

  it("parses dailyTokenBudget as positive integer", () => {
    expect(parseGuardrailConfig({ enabled: true, dailyTokenBudget: 500_000 })).toMatchObject({
      dailyTokenBudget: 500_000,
    });
  });

  it("drops dailyTokenBudget <= 0", () => {
    const result = parseGuardrailConfig({ enabled: true, dailyTokenBudget: 0 });
    expect(result.dailyTokenBudget).toBeUndefined();
  });

  it("parses dailyCostCapUsd", () => {
    expect(parseGuardrailConfig({ enabled: true, dailyCostCapUsd: 5.5 })).toMatchObject({
      dailyCostCapUsd: 5.5,
    });
  });

  it("parses rules", () => {
    const raw = {
      enabled: true,
      rules: { warnThresholdPercent: 70, action: "pause" },
    };
    const result = parseGuardrailConfig(raw);
    expect(result.rules?.warnThresholdPercent).toBe(70);
    expect(result.rules?.action).toBe("pause");
  });

  it("clamps warnThresholdPercent to [0, 100]", () => {
    const raw = {
      enabled: true,
      rules: { warnThresholdPercent: 150, action: "warn" },
    };
    expect(parseGuardrailConfig(raw).rules?.warnThresholdPercent).toBe(100);
  });

  it("defaults unknown action to warn", () => {
    const raw = {
      enabled: true,
      rules: { warnThresholdPercent: 80, action: "destroy" },
    };
    expect(parseGuardrailConfig(raw).rules?.action).toBe("warn");
  });
});

// ── serializeGuardrailConfig ──────────────────────────────────────────────────

describe("serializeGuardrailConfig", () => {
  it("always includes enabled field", () => {
    const config: GuardrailConfig = { enabled: false };
    expect(serializeGuardrailConfig(config)).toMatchObject({ enabled: false });
  });

  it("omits undefined optional fields", () => {
    const config: GuardrailConfig = { enabled: true };
    const serialized = serializeGuardrailConfig(config);
    expect("dailyTokenBudget" in serialized).toBe(false);
    expect("perSessionTokenBudget" in serialized).toBe(false);
    expect("dailyCostCapUsd" in serialized).toBe(false);
    expect("rules" in serialized).toBe(false);
  });

  it("includes defined optional fields", () => {
    const config: GuardrailConfig = {
      enabled: true,
      dailyTokenBudget: 500_000,
      perSessionTokenBudget: 100_000,
      dailyCostCapUsd: 10,
      rules: { warnThresholdPercent: 75, action: "pause" },
    };
    const serialized = serializeGuardrailConfig(config);
    expect(serialized.dailyTokenBudget).toBe(500_000);
    expect(serialized.perSessionTokenBudget).toBe(100_000);
    expect(serialized.dailyCostCapUsd).toBe(10);
    expect(serialized.rules).toEqual({ warnThresholdPercent: 75, action: "pause" });
  });

  it("round-trips through parse → serialize", () => {
    const original: GuardrailConfig = {
      enabled: true,
      dailyTokenBudget: 250_000,
      dailyCostCapUsd: 7.5,
      rules: { warnThresholdPercent: 85, action: "warn" },
    };
    const roundTripped = parseGuardrailConfig(serializeGuardrailConfig(original));
    expect(roundTripped).toEqual(original);
  });
});
