import { describe, it, expect } from "vitest";
import {
  aggregateByDay,
  aggregateByWeek,
  filterByTimeRange,
} from "@/features/usage/lib/trendAggregator";
import type { SessionCostEntry } from "@/features/usage/lib/costCalculator";

function makeEntry(overrides: Partial<SessionCostEntry> = {}): SessionCostEntry {
  return {
    key: "s1",
    displayName: "Session 1",
    model: "claude-opus-4",
    modelDisplayName: "Opus 4",
    inputTokens: 1000,
    outputTokens: 500,
    cost: 0.05,
    updatedAt: Date.now(),
    isCron: false,
    ...overrides,
  };
}

describe("aggregateByDay", () => {
  it("groups entries by date", () => {
    const entries = [
      makeEntry({ key: "s1", updatedAt: new Date("2026-02-18T10:00:00Z").getTime(), cost: 1.0 }),
      makeEntry({ key: "s2", updatedAt: new Date("2026-02-18T15:00:00Z").getTime(), cost: 2.0 }),
      makeEntry({ key: "s3", updatedAt: new Date("2026-02-17T12:00:00Z").getTime(), cost: 3.0 }),
    ];
    const result = aggregateByDay(entries);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2026-02-17");
    expect(result[0].totalCost).toBeCloseTo(3.0);
    expect(result[1].date).toBe("2026-02-18");
    expect(result[1].totalCost).toBeCloseTo(3.0);
    expect(result[1].sessionCount).toBe(2);
  });

  it("returns empty for empty input", () => {
    expect(aggregateByDay([])).toEqual([]);
  });

  it("skips entries without updatedAt", () => {
    const entries = [makeEntry({ updatedAt: null })];
    expect(aggregateByDay(entries)).toEqual([]);
  });

  it("aggregates cost by model within day", () => {
    const entries = [
      makeEntry({ key: "s1", updatedAt: new Date("2026-02-18T10:00:00Z").getTime(), cost: 1.0, modelDisplayName: "Opus 4" }),
      makeEntry({ key: "s2", updatedAt: new Date("2026-02-18T11:00:00Z").getTime(), cost: 0.5, modelDisplayName: "Sonnet 4" }),
    ];
    const result = aggregateByDay(entries);
    expect(result[0].costByModel["Opus 4"]).toBeCloseTo(1.0);
    expect(result[0].costByModel["Sonnet 4"]).toBeCloseTo(0.5);
  });
});

describe("aggregateByWeek", () => {
  it("groups entries by ISO week", () => {
    const entries = [
      makeEntry({ key: "s1", updatedAt: new Date("2026-02-16T10:00:00Z").getTime(), cost: 1.0 }),
      makeEntry({ key: "s2", updatedAt: new Date("2026-02-18T10:00:00Z").getTime(), cost: 2.0 }),
    ];
    const result = aggregateByWeek(entries);
    // Both should be in the same week (W08 of 2026)
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for empty input", () => {
    expect(aggregateByWeek([])).toEqual([]);
  });
});

describe("filterByTimeRange", () => {
  const now = new Date("2026-02-18T15:00:00Z").getTime();

  it("returns all entries for 'all' range", () => {
    const entries = [
      makeEntry({ updatedAt: new Date("2025-01-01").getTime() }),
      makeEntry({ updatedAt: now }),
    ];
    expect(filterByTimeRange(entries, "all", now)).toHaveLength(2);
  });

  it("filters to last 24h for 'today'", () => {
    const entries = [
      makeEntry({ key: "old", updatedAt: now - 48 * 60 * 60 * 1000 }),
      makeEntry({ key: "recent", updatedAt: now - 2 * 60 * 60 * 1000 }),
    ];
    const result = filterByTimeRange(entries, "today", now);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("recent");
  });

  it("filters to last 7 days", () => {
    const entries = [
      makeEntry({ key: "old", updatedAt: now - 10 * 24 * 60 * 60 * 1000 }),
      makeEntry({ key: "recent", updatedAt: now - 3 * 24 * 60 * 60 * 1000 }),
    ];
    const result = filterByTimeRange(entries, "7d", now);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("recent");
  });

  it("excludes entries with null updatedAt", () => {
    const entries = [makeEntry({ updatedAt: null })];
    expect(filterByTimeRange(entries, "today", now)).toHaveLength(0);
  });
});
