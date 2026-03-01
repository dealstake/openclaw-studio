import { describe, it, expect } from "vitest";
import {
  computeMetricStats,
  computeBaselinesFromEvents,
} from "@/features/activity/lib/baselineComputer";
import type { ActivityEvent } from "@/features/activity/lib/activityTypes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    type: "cron",
    taskName: "Daily Summary",
    taskId: "task-1",
    projectSlug: null,
    projectName: null,
    status: "success",
    summary: "Done",
    meta: {},
    agentId: "alex",
    tokensIn: null,
    tokensOut: null,
    model: null,
    ...overrides,
  };
}

// ─── computeMetricStats ───────────────────────────────────────────────────────

describe("computeMetricStats", () => {
  it("returns zeros for empty array", () => {
    const stats = computeMetricStats([]);
    expect(stats.mean).toBe(0);
    expect(stats.stdDev).toBe(0);
    expect(stats.sampleCount).toBe(0);
  });

  it("returns correct stats for single value", () => {
    const stats = computeMetricStats([42]);
    expect(stats.mean).toBe(42);
    expect(stats.stdDev).toBe(0);
    expect(stats.sampleCount).toBe(1);
  });

  it("computes mean correctly", () => {
    const stats = computeMetricStats([10, 20, 30]);
    expect(stats.mean).toBe(20);
    expect(stats.sampleCount).toBe(3);
  });

  it("computes population stdDev correctly for [2, 4, 4, 4, 5, 5, 7, 9]", () => {
    // Classic textbook example: mean=5, stdDev=2
    const stats = computeMetricStats([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stats.mean).toBe(5);
    expect(stats.stdDev).toBeCloseTo(2, 5);
    expect(stats.sampleCount).toBe(8);
  });

  it("computes stdDev=0 for all-identical values", () => {
    const stats = computeMetricStats([7, 7, 7, 7]);
    expect(stats.mean).toBe(7);
    expect(stats.stdDev).toBe(0);
  });

  it("handles negative values", () => {
    const stats = computeMetricStats([-10, 0, 10]);
    expect(stats.mean).toBe(0);
    expect(stats.stdDev).toBeCloseTo(8.165, 2);
  });
});

// ─── computeBaselinesFromEvents ───────────────────────────────────────────────

describe("computeBaselinesFromEvents", () => {
  it("returns empty array for no events", () => {
    const baselines = computeBaselinesFromEvents("alex", []);
    expect(baselines).toHaveLength(0);
  });

  it("produces one baseline per (agentId, taskId) pair", () => {
    const events: ActivityEvent[] = [
      makeEvent({ taskId: "task-1", agentId: "alex" }),
      makeEvent({ taskId: "task-1", agentId: "alex" }),
      makeEvent({ taskId: "task-2", agentId: "alex" }),
    ];
    const baselines = computeBaselinesFromEvents("alex", events);
    expect(baselines).toHaveLength(2);
    const ids = baselines.map((b) => b.id).sort();
    expect(ids).toEqual(["alex:task-1", "alex:task-2"]);
  });

  it("computes correct sample count for totalTokens", () => {
    const events = [
      makeEvent({ taskId: "task-1", tokensIn: 100, tokensOut: 50 }),
      makeEvent({ taskId: "task-1", tokensIn: 200, tokensOut: 100 }),
      makeEvent({ taskId: "task-1", tokensIn: 300, tokensOut: 150 }),
    ];
    const baselines = computeBaselinesFromEvents("alex", events);
    expect(baselines).toHaveLength(1);
    const b = baselines[0];
    expect(b.totalTokens.sampleCount).toBe(3);
    // Values: 150, 300, 450 → mean = 300
    expect(b.totalTokens.mean).toBe(300);
  });

  it("computes error rate correctly", () => {
    const events = [
      makeEvent({ taskId: "task-1", status: "success" }),
      makeEvent({ taskId: "task-1", status: "error" }),
      makeEvent({ taskId: "task-1", status: "error" }),
      makeEvent({ taskId: "task-1", status: "success" }),
    ];
    const baselines = computeBaselinesFromEvents("alex", events);
    const b = baselines[0];
    // 2 errors out of 4 → mean error rate = 0.5
    expect(b.errorRate.mean).toBe(0.5);
    expect(b.errorRate.sampleCount).toBe(4);
  });

  it("populates id as <agentId>:<taskId>", () => {
    const events = [makeEvent({ agentId: "bob", taskId: "job-abc" })];
    const baselines = computeBaselinesFromEvents("bob", events);
    expect(baselines[0].id).toBe("bob:job-abc");
    expect(baselines[0].agentId).toBe("bob");
    expect(baselines[0].taskId).toBe("job-abc");
  });

  it("uses fallback agentId for events without agentId", () => {
    const events = [makeEvent({ agentId: undefined, taskId: "task-x" })];
    const baselines = computeBaselinesFromEvents("alex", events);
    expect(baselines[0].agentId).toBe("alex");
    expect(baselines[0].id).toBe("alex:task-x");
  });

  it("extracts durationMs from meta", () => {
    const events = [
      makeEvent({ taskId: "task-1", meta: { durationMs: 5000 } }),
      makeEvent({ taskId: "task-1", meta: { durationMs: 7000 } }),
    ];
    const baselines = computeBaselinesFromEvents("alex", events);
    const b = baselines[0];
    expect(b.durationMs.mean).toBe(6000);
    expect(b.durationMs.sampleCount).toBe(2);
  });

  it("has zero durationMs sampleCount when meta.durationMs is absent", () => {
    const events = [
      makeEvent({ taskId: "task-1", meta: {} }),
      makeEvent({ taskId: "task-1", meta: {} }),
    ];
    const baselines = computeBaselinesFromEvents("alex", events);
    const b = baselines[0];
    expect(b.durationMs.sampleCount).toBe(0);
    expect(b.durationMs.mean).toBe(0);
  });

  it("stores windowDays in each baseline", () => {
    const events = [makeEvent({ taskId: "task-1" })];
    const baselines = computeBaselinesFromEvents("alex", events, 14);
    expect(baselines[0].windowDays).toBe(14);
  });

  it("keeps the most recent taskName", () => {
    const events = [
      makeEvent({ taskId: "task-1", taskName: "Old Name" }),
      makeEvent({ taskId: "task-1", taskName: "New Name" }),
    ];
    const baselines = computeBaselinesFromEvents("alex", events);
    // Last event's taskName wins
    expect(baselines[0].taskName).toBe("New Name");
  });

  it("computes cost stats when model is known", () => {
    const events = [
      makeEvent({
        taskId: "task-1",
        model: "anthropic/claude-sonnet-4-6",
        tokensIn: 1_000_000,
        tokensOut: 0,
      }),
      makeEvent({
        taskId: "task-1",
        model: "anthropic/claude-sonnet-4-6",
        tokensIn: 1_000_000,
        tokensOut: 0,
      }),
    ];
    const baselines = computeBaselinesFromEvents("alex", events);
    const b = baselines[0];
    // $3 per 1M input for claude-sonnet-4-6
    expect(b.costUsd.mean).toBeCloseTo(3, 5);
    expect(b.costUsd.sampleCount).toBe(2);
  });

  it("skips cost computation when model is unknown", () => {
    const events = [
      makeEvent({ taskId: "task-1", model: null, tokensIn: 1000, tokensOut: 500 }),
    ];
    const baselines = computeBaselinesFromEvents("alex", events);
    const b = baselines[0];
    expect(b.costUsd.sampleCount).toBe(0);
    expect(b.costUsd.mean).toBe(0);
  });
});
