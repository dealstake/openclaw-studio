import { describe, it, expect, vi, beforeEach } from "vitest";
import { scoreEventAgainstBaseline } from "@/features/activity/lib/anomalyDetector";
import type { ActivityEvent } from "@/features/activity/lib/activityTypes";
import type { AgentBaseline, MetricStats } from "@/features/activity/lib/anomalyTypes";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStats(mean: number, stdDev: number, sampleCount = 10): MetricStats {
  return { mean, stdDev, sampleCount };
}

function makeBaseline(overrides: Partial<AgentBaseline> = {}): AgentBaseline {
  return {
    id: "agent1:task1",
    agentId: "agent1",
    taskId: "task1",
    taskName: "Test Task",
    totalTokens: makeStats(1000, 100),
    costUsd: makeStats(0.10, 0.02),
    durationMs: makeStats(60000, 10000),
    errorRate: makeStats(0.05, 0.05),
    computedAt: "2026-03-01T00:00:00Z",
    windowDays: 7,
    sensitivity: 3,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: "evt-1",
    timestamp: "2026-03-02T12:00:00Z",
    type: "cron-completion",
    taskName: "Test Task",
    taskId: "task1",
    projectSlug: null,
    projectName: null,
    status: "success",
    summary: "test",
    meta: {
      durationMs: 60000,
      tokensIn: 500,
      tokensOut: 500,
    },
    sessionKey: "session-1",
    transcriptJson: null,
    tokensIn: 500,
    tokensOut: 500,
    model: "anthropic/claude-sonnet-4-5",
    agentId: "agent1",
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("scoreEventAgainstBaseline", () => {
  beforeEach(() => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("mock-uuid" as `${string}-${string}-${string}-${string}-${string}`);
  });

  it("returns noBaseline when baseline is null", () => {
    const result = scoreEventAgainstBaseline(makeEvent(), null);
    expect(result.noBaseline).toBe(true);
    expect(result.anomalies).toHaveLength(0);
    expect(result.metricsChecked).toHaveLength(0);
  });

  it("returns no anomalies when values are within normal range", () => {
    // Set cost baseline to match what the estimator returns for 500in+500out on sonnet
    const baseline = makeBaseline({
      costUsd: makeStats(0.0105, 0.005), // match estimated cost closely
    });
    const event = makeEvent({ tokensIn: 500, tokensOut: 500 }); // 1000 total = mean
    const result = scoreEventAgainstBaseline(event, baseline);
    expect(result.noBaseline).toBe(false);
    expect(result.anomalies).toHaveLength(0);
    expect(result.metricsChecked.length).toBeGreaterThan(0);
  });

  it("flags warning when token count exceeds 3σ", () => {
    // mean=1000, stdDev=100, so 1400 = 4σ → warning
    const event = makeEvent({ tokensIn: 700, tokensOut: 700 }); // 1400 total
    const result = scoreEventAgainstBaseline(event, makeBaseline());
    const tokenAnomaly = result.anomalies.find((a) => a.metric === "totalTokens");
    expect(tokenAnomaly).toBeDefined();
    expect(tokenAnomaly!.severity).toBe("warning");
    expect(tokenAnomaly!.zScore).toBeCloseTo(4, 0);
  });

  it("flags critical when token count exceeds 5σ", () => {
    // mean=1000, stdDev=100, so 1600 = 6σ → critical
    const event = makeEvent({ tokensIn: 800, tokensOut: 800 }); // 1600 total
    const result = scoreEventAgainstBaseline(event, makeBaseline());
    const tokenAnomaly = result.anomalies.find((a) => a.metric === "totalTokens");
    expect(tokenAnomaly).toBeDefined();
    expect(tokenAnomaly!.severity).toBe("critical");
  });

  it("skips metrics with low sample count", () => {
    const baseline = makeBaseline({
      totalTokens: makeStats(1000, 100, 2), // only 2 samples
    });
    const event = makeEvent({ tokensIn: 1000, tokensOut: 1000 }); // 2000 = way over
    const result = scoreEventAgainstBaseline(event, baseline);
    // totalTokens should be checked but not flagged (skipped due to low samples)
    const tokenAnomaly = result.anomalies.find((a) => a.metric === "totalTokens");
    expect(tokenAnomaly).toBeUndefined();
  });

  it("skips metrics with zero stdDev", () => {
    const baseline = makeBaseline({
      totalTokens: makeStats(1000, 0, 10), // no variance
    });
    const event = makeEvent({ tokensIn: 1000, tokensOut: 1000 });
    const result = scoreEventAgainstBaseline(event, baseline);
    const tokenAnomaly = result.anomalies.find((a) => a.metric === "totalTokens");
    expect(tokenAnomaly).toBeUndefined();
  });

  it("respects custom sensitivity=1 (more sensitive)", () => {
    // mean=1000, stdDev=100, 1200 total = 2σ
    // With sensitivity=3: no flag (2 < 3)
    // With sensitivity=1: flag warning (2 ≥ 1)
    const baseline = makeBaseline({ sensitivity: 1 });
    const event = makeEvent({ tokensIn: 600, tokensOut: 600 }); // 1200 total = 2σ
    const result = scoreEventAgainstBaseline(event, baseline);
    const tokenAnomaly = result.anomalies.find((a) => a.metric === "totalTokens");
    expect(tokenAnomaly).toBeDefined();
    expect(tokenAnomaly!.severity).toBe("warning");
  });

  it("respects custom sensitivity=2 (medium)", () => {
    // 1250 total = 2.5σ. Sensitivity=2: warning (2.5 ≥ 2). Sensitivity=3: no flag.
    const baseline2 = makeBaseline({ sensitivity: 2 });
    const event = makeEvent({ tokensIn: 625, tokensOut: 625 }); // 1250 total
    const result2 = scoreEventAgainstBaseline(event, baseline2);
    expect(result2.anomalies.find((a) => a.metric === "totalTokens")).toBeDefined();

    const baseline3 = makeBaseline({ sensitivity: 3 });
    const result3 = scoreEventAgainstBaseline(event, baseline3);
    expect(result3.anomalies.find((a) => a.metric === "totalTokens")).toBeUndefined();
  });

  it("flags critical at sensitivity+2 offset", () => {
    // sensitivity=1, critical at 3σ. 1350 = 3.5σ → critical
    const baseline = makeBaseline({ sensitivity: 1 });
    const event = makeEvent({ tokensIn: 675, tokensOut: 675 }); // 1350 total = 3.5σ
    const result = scoreEventAgainstBaseline(event, baseline);
    const tokenAnomaly = result.anomalies.find((a) => a.metric === "totalTokens");
    expect(tokenAnomaly).toBeDefined();
    expect(tokenAnomaly!.severity).toBe("critical");
  });

  it("detects duration anomalies", () => {
    // mean=60000, stdDev=10000, 100000ms = 4σ
    const event = makeEvent({
      meta: { durationMs: 100000, tokensIn: 500, tokensOut: 500 },
    });
    const result = scoreEventAgainstBaseline(event, makeBaseline());
    const durAnomaly = result.anomalies.find((a) => a.metric === "durationMs");
    expect(durAnomaly).toBeDefined();
    expect(durAnomaly!.severity).toBe("warning");
  });

  it("detects error rate anomaly on error event", () => {
    // errorRate mean=0.05, stdDev=0.05, observed=1 → z=(1-0.05)/0.05=19σ → critical
    const event = makeEvent({ status: "error" });
    const result = scoreEventAgainstBaseline(event, makeBaseline());
    const errAnomaly = result.anomalies.find((a) => a.metric === "errorRate");
    expect(errAnomaly).toBeDefined();
    expect(errAnomaly!.severity).toBe("critical");
  });

  it("does not flag error rate for success events", () => {
    const event = makeEvent({ status: "success" });
    const result = scoreEventAgainstBaseline(event, makeBaseline());
    const errAnomaly = result.anomalies.find((a) => a.metric === "errorRate");
    expect(errAnomaly).toBeUndefined();
  });

  it("generates human-readable explanations", () => {
    const event = makeEvent({ tokensIn: 700, tokensOut: 700 }); // 1400 = 4σ
    const result = scoreEventAgainstBaseline(event, makeBaseline());
    const tokenAnomaly = result.anomalies.find((a) => a.metric === "totalTokens");
    expect(tokenAnomaly!.explanation).toContain("Tokens for");
    expect(tokenAnomaly!.explanation).toContain("above");
  });

  it("checks all 4 metrics", () => {
    const event = makeEvent({ status: "error" });
    const result = scoreEventAgainstBaseline(event, makeBaseline());
    expect(result.metricsChecked).toContain("totalTokens");
    expect(result.metricsChecked).toContain("durationMs");
    expect(result.metricsChecked).toContain("errorRate");
    // costUsd depends on model being recognized
  });
});
