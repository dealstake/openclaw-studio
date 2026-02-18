import { describe, it, expect } from "vitest";
import { computeJobStats, rankJobsByTokens } from "@/features/activity/lib/cronStatsCalculator";
import type { CronRunEntry } from "@/lib/cron/types";

const makeRun = (overrides: Partial<CronRunEntry> = {}): CronRunEntry => ({
  id: "run-1",
  jobId: "job-1",
  status: "ok",
  startedAtMs: 1000000,
  durationMs: 5000,
  ...overrides,
});

describe("computeJobStats", () => {
  it("computes counts and averages for mixed runs", () => {
    const runs: CronRunEntry[] = [
      makeRun({ id: "r1", status: "ok", durationMs: 4000 }),
      makeRun({ id: "r2", status: "ok", durationMs: 6000 }),
      makeRun({ id: "r3", status: "error", durationMs: 2000 }),
    ];
    const stats = computeJobStats("job-1", "Test Job", runs);
    expect(stats.totalRuns).toBe(3);
    expect(stats.successCount).toBe(2);
    expect(stats.failCount).toBe(1);
    expect(stats.avgDurationMs).toBe(4000);
    expect(stats.successRate).toBeCloseTo(2 / 3);
  });

  it("handles empty runs", () => {
    const stats = computeJobStats("job-1", "Empty", []);
    expect(stats.totalRuns).toBe(0);
    expect(stats.successRate).toBe(0);
    expect(stats.avgDurationMs).toBe(0);
    expect(stats.totalTokens).toBe(0);
  });

  it("joins tokens from session map within 30s window", () => {
    const runs = [makeRun({ startedAtMs: 100000 })];
    const tokenMap = new Map([[100010, 5000]]); // within 30s
    const stats = computeJobStats("job-1", "Tokens", runs, tokenMap);
    expect(stats.totalTokens).toBe(5000);
  });

  it("does not join tokens outside 30s window", () => {
    const runs = [makeRun({ startedAtMs: 100000 })];
    const tokenMap = new Map([[200000, 5000]]); // outside window
    const stats = computeJobStats("job-1", "Tokens", runs, tokenMap);
    expect(stats.totalTokens).toBe(0);
  });

  it("builds duration trend from runs", () => {
    const runs = [
      makeRun({ durationMs: 1000 }),
      makeRun({ durationMs: 2000 }),
      makeRun({ durationMs: 3000 }),
    ];
    const stats = computeJobStats("job-1", "Trend", runs);
    expect(stats.durationTrend).toEqual([1000, 2000, 3000]);
  });
});

describe("rankJobsByTokens", () => {
  it("sorts jobs by total tokens descending", () => {
    const stats = [
      computeJobStats("a", "Low", []),
      computeJobStats("b", "High", [makeRun({ startedAtMs: 100 })], new Map([[100, 9000]])),
      computeJobStats("c", "Mid", [makeRun({ startedAtMs: 200 })], new Map([[200, 3000]])),
    ];
    const ranked = rankJobsByTokens(stats);
    expect(ranked.map((s) => s.jobName)).toEqual(["High", "Mid", "Low"]);
  });
});
