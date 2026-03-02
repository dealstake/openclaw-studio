import { describe, it, expect, vi } from "vitest";
import {
  shouldCooldown,
  evaluateBudgetRule,
  evaluateCompletionRule,
  evaluateErrorRule,
  evaluateRateLimitRule,
  evaluateAnomalyRule,
} from "@/features/notifications/lib/alertEvaluator";
import { formatRuleThreshold } from "@/features/notifications/lib/formatRuleThreshold";
import { DEFAULT_ALERT_RULES } from "@/features/notifications/lib/defaults";
import type { AlertRule } from "@/features/notifications/lib/types";

// ─── Helper ──────────────────────────────────────────────────────────────────

const makeRule = (overrides: Partial<AlertRule> = {}): AlertRule => ({
  id: "test-rule",
  type: "budget",
  enabled: true,
  threshold: 1000,
  cooldownMs: 60_000,
  label: "Test Rule",
  ...overrides,
});

// ─── shouldCooldown ──────────────────────────────────────────────────────────

describe("shouldCooldown", () => {
  it("returns false when rule has never fired", () => {
    const lastFired = new Map<string, number>();
    expect(shouldCooldown(makeRule(), lastFired, Date.now())).toBe(false);
  });

  it("returns true when within cooldown period", () => {
    const now = Date.now();
    const lastFired = new Map([["test-rule", now - 30_000]]); // 30s ago
    expect(shouldCooldown(makeRule({ cooldownMs: 60_000 }), lastFired, now)).toBe(true);
  });

  it("returns false when cooldown has elapsed", () => {
    const now = Date.now();
    const lastFired = new Map([["test-rule", now - 120_000]]); // 2min ago
    expect(shouldCooldown(makeRule({ cooldownMs: 60_000 }), lastFired, now)).toBe(false);
  });
});

// ─── evaluateBudgetRule ──────────────────────────────────────────────────────

describe("evaluateBudgetRule", () => {
  it("returns null when disabled", () => {
    expect(evaluateBudgetRule(makeRule({ enabled: false }), 5000)).toBeNull();
  });

  it("returns null when type is not budget", () => {
    expect(evaluateBudgetRule(makeRule({ type: "error" }), 5000)).toBeNull();
  });

  it("returns null when below threshold", () => {
    expect(evaluateBudgetRule(makeRule({ threshold: 5000 }), 4999)).toBeNull();
  });

  it("fires when at threshold", () => {
    const result = evaluateBudgetRule(makeRule({ threshold: 5000 }), 5000);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("budget");
    expect(result!.title).toBe("Token budget exceeded");
    expect(result!.read).toBe(false);
    expect(result!.data).toEqual({ dailyTokens: 5000, threshold: 5000 });
  });

  it("fires when above threshold", () => {
    const result = evaluateBudgetRule(makeRule({ threshold: 1000 }), 2000);
    expect(result).not.toBeNull();
    expect(result!.body).toContain("2,000");
  });
});

// ─── evaluateCompletionRule ──────────────────────────────────────────────────

describe("evaluateCompletionRule", () => {
  const rule = makeRule({ type: "completion", threshold: 1 });

  it("returns null when disabled", () => {
    expect(evaluateCompletionRule(makeRule({ type: "completion", enabled: false }), { state: "complete" })).toBeNull();
  });

  it("returns null for non-completion type", () => {
    expect(evaluateCompletionRule(makeRule({ type: "budget" }), { state: "complete" })).toBeNull();
  });

  it("returns null when state is not complete/end", () => {
    expect(evaluateCompletionRule(rule, { state: "running" })).toBeNull();
  });

  it("fires on state=complete with agentId", () => {
    const result = evaluateCompletionRule(rule, { state: "complete", agentId: "alex" });
    expect(result).not.toBeNull();
    expect(result!.type).toBe("completion");
    expect(result!.body).toContain("alex");
  });

  it("fires on state=end without agentId", () => {
    const result = evaluateCompletionRule(rule, { state: "end" });
    expect(result).not.toBeNull();
    expect(result!.body).toBe("An agent run completed");
  });
});

// ─── evaluateErrorRule ───────────────────────────────────────────────────────

describe("evaluateErrorRule", () => {
  const rule = makeRule({ type: "error", threshold: 3, cooldownMs: 300_000 });

  it("returns null when disabled", () => {
    expect(evaluateErrorRule(makeRule({ type: "error", enabled: false }), [])).toBeNull();
  });

  it("returns null when below threshold", () => {
    const now = Date.now();
    const errors = [{ timestamp: now - 1000 }, { timestamp: now - 2000 }];
    expect(evaluateErrorRule(rule, errors)).toBeNull();
  });

  it("fires when errors in window meet threshold", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const errors = [
      { timestamp: now - 1000 },
      { timestamp: now - 2000 },
      { timestamp: now - 3000 },
    ];
    const result = evaluateErrorRule(rule, errors);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("error");
    expect(result!.data).toEqual({ errorCount: 3, windowMs: 300_000 });
    vi.restoreAllMocks();
  });

  it("excludes old errors outside window", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const errors = [
      { timestamp: now - 1000 },
      { timestamp: now - 2000 },
      { timestamp: now - 600_000 }, // outside 5min window
    ];
    expect(evaluateErrorRule(rule, errors)).toBeNull();
    vi.restoreAllMocks();
  });

  it("uses DEFAULT_ERROR_WINDOW_MS when cooldownMs is 0", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const zeroRule = makeRule({ type: "error", threshold: 2, cooldownMs: 0 });
    const errors = [
      { timestamp: now - 1000 },
      { timestamp: now - 200_000 }, // within 5min default window
    ];
    const result = evaluateErrorRule(zeroRule, errors);
    expect(result).not.toBeNull();
    vi.restoreAllMocks();
  });
});

// ─── evaluateRateLimitRule ───────────────────────────────────────────────────

describe("evaluateRateLimitRule", () => {
  const rule = makeRule({ type: "rateLimit", threshold: 80 });

  it("returns null when disabled", () => {
    expect(evaluateRateLimitRule(makeRule({ type: "rateLimit", enabled: false }), 90)).toBeNull();
  });

  it("returns null when below threshold", () => {
    expect(evaluateRateLimitRule(rule, 79)).toBeNull();
  });

  it("fires at threshold", () => {
    const result = evaluateRateLimitRule(rule, 80);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("rateLimit");
    expect(result!.body).toContain("80%");
  });

  it("fires above threshold", () => {
    const result = evaluateRateLimitRule(rule, 95);
    expect(result).not.toBeNull();
    expect(result!.body).toContain("95%");
  });
});

// ─── formatRuleThreshold ─────────────────────────────────────────────────────

describe("formatRuleThreshold", () => {
  it("formats budget rule", () => {
    expect(formatRuleThreshold(makeRule({ type: "budget", threshold: 5_000_000 }))).toBe("Threshold: 5000K tokens");
  });

  it("formats completion rule", () => {
    expect(formatRuleThreshold(makeRule({ type: "completion" }))).toBe("All sub-agent completions");
  });

  it("formats error rule", () => {
    expect(formatRuleThreshold(makeRule({ type: "error", threshold: 3 }))).toBe("3 errors in window");
  });

  it("formats rateLimit rule", () => {
    expect(formatRuleThreshold(makeRule({ type: "rateLimit", threshold: 80 }))).toBe("80% of budget");
  });

  it("returns empty for unknown type", () => {
    expect(formatRuleThreshold(makeRule({ type: "unknown" as never }))).toBe("");
  });
});

// ─── evaluateAnomalyRule ─────────────────────────────────────────────────────

describe("evaluateAnomalyRule", () => {
  const anomalyRule = makeRule({ type: "anomaly", threshold: 1, cooldownMs: 3_600_000 });

  const makeAnomaly = (overrides: Record<string, unknown> = {}) => ({
    id: "a1",
    agentId: "agent-1",
    taskId: "task-1",
    taskName: "Daily Summary",
    eventId: "ev-1",
    eventTimestamp: new Date().toISOString(),
    metric: "costUsd" as const,
    observedValue: 0.52,
    baselineMean: 0.11,
    baselineStdDev: 0.03,
    zScore: 13.67,
    severity: "critical" as const,
    explanation: "Cost was 4.5x above baseline",
    sessionKey: "sess-1",
    dismissed: false,
    detectedAt: new Date().toISOString(),
    ...overrides,
  });

  it("returns null when rule is disabled", () => {
    expect(evaluateAnomalyRule({ ...anomalyRule, enabled: false }, [makeAnomaly()])).toBeNull();
  });

  it("returns null when below threshold", () => {
    const rule = makeRule({ type: "anomaly", threshold: 3, cooldownMs: 0 });
    expect(evaluateAnomalyRule(rule, [makeAnomaly()])).toBeNull();
  });

  it("creates a notification for a single anomaly", () => {
    const n = evaluateAnomalyRule(anomalyRule, [makeAnomaly()]);
    expect(n).not.toBeNull();
    expect(n!.type).toBe("anomaly");
    expect(n!.title).toContain("Daily Summary");
    expect(n!.body).toContain("1 behavioral anomaly");
  });

  it("creates a digest for multiple anomalies", () => {
    const anomalies = [
      makeAnomaly({ id: "a1", severity: "critical" }),
      makeAnomaly({ id: "a2", taskId: "task-2", taskName: "Health Check", severity: "warning" }),
    ];
    const n = evaluateAnomalyRule(anomalyRule, anomalies);
    expect(n).not.toBeNull();
    expect(n!.body).toContain("2 behavioral anomalies");
    expect(n!.body).toContain("1 critical");
    expect(n!.body).toContain("1 warning");
  });

  it("summarizes many task names", () => {
    const anomalies = [
      makeAnomaly({ id: "a1", taskName: "Task A" }),
      makeAnomaly({ id: "a2", taskName: "Task B" }),
      makeAnomaly({ id: "a3", taskName: "Task C" }),
    ];
    const n = evaluateAnomalyRule(anomalyRule, anomalies);
    expect(n!.title).toContain("Task A and 2 others");
  });
});

// ─── DEFAULT_ALERT_RULES ────────────────────────────────────────────────────

describe("DEFAULT_ALERT_RULES", () => {
  it("has 5 default rules", () => {
    expect(DEFAULT_ALERT_RULES).toHaveLength(5);
  });

  it("has unique IDs", () => {
    const ids = DEFAULT_ALERT_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rateLimit rule is disabled by default", () => {
    const rl = DEFAULT_ALERT_RULES.find((r) => r.type === "rateLimit");
    expect(rl?.enabled).toBe(false);
  });

  it("covers all rule types", () => {
    const types = new Set(DEFAULT_ALERT_RULES.map((r) => r.type));
    expect(types).toEqual(new Set(["budget", "completion", "error", "rateLimit", "anomaly"]));
  });
});
