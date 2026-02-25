import { describe, it, expect } from "vitest";
import {
  calculateSessionCosts,
  type RawSessionEntry,
} from "@/features/usage/lib/costCalculator";
import {
  getModelPricing,
  getModelDisplayName,
} from "@/features/usage/lib/pricingTable";
import {
  aggregateByDay,
  filterByTimeRange,
} from "@/features/usage/lib/trendAggregator";
import type { SessionCostEntry } from "@/features/usage/lib/costCalculator";

// ─── pricingTable ────────────────────────────────────────────────────────────

describe("getModelPricing", () => {
  it("returns pricing for known model", () => {
    const p = getModelPricing("claude-opus-4");
    expect(p).toEqual({ inputPer1M: 15, outputPer1M: 75 });
  });

  it("strips provider prefix", () => {
    const p = getModelPricing("anthropic/claude-opus-4-0620");
    expect(p).not.toBeNull();
    expect(p!.inputPer1M).toBe(15);
  });

  it("returns null for unknown model", () => {
    expect(getModelPricing("gpt-4o")).toBeNull();
  });

  it("handles Gemini models", () => {
    expect(getModelPricing("gemini-2.5-pro")).toEqual({ inputPer1M: 1.25, outputPer1M: 10 });
  });

  it("fuzzy matches versioned models", () => {
    expect(getModelPricing("claude-opus-4-0620-preview")).not.toBeNull();
  });
});

describe("getModelDisplayName", () => {
  it("returns Opus 4 for opus models", () => {
    expect(getModelDisplayName("anthropic/claude-opus-4-0620")).toBe("Opus 4");
  });

  it("returns Sonnet 4 for sonnet-4", () => {
    expect(getModelDisplayName("claude-sonnet-4")).toBe("Sonnet 4");
  });

  it("returns Sonnet 3.5 for older sonnet", () => {
    expect(getModelDisplayName("claude-3-5-sonnet-20241022")).toBe("Sonnet 3.5");
  });

  it("returns normalized string for unknown", () => {
    expect(getModelDisplayName("gpt-4o")).toBe("gpt-4o");
  });
});

// ─── costCalculator ──────────────────────────────────────────────────────────

describe("calculateSessionCosts", () => {
  const makeSessions = (...overrides: Partial<RawSessionEntry>[]): RawSessionEntry[] =>
    overrides.map((o, i) => ({
      key: `session-${i}`,
      model: "claude-opus-4",
      inputTokens: 1000,
      outputTokens: 500,
      updatedAt: Date.now(),
      ...o,
    }));

  it("calculates cost for known model", () => {
    const result = calculateSessionCosts(makeSessions({ inputTokens: 1_000_000, outputTokens: 1_000_000 }));
    expect(result.totalCost).toBeCloseTo(15 + 75); // $15 input + $75 output
    expect(result.entries[0].cost).toBeCloseTo(90);
  });

  it("returns null cost for unknown model", () => {
    const result = calculateSessionCosts(makeSessions({ model: "gpt-4o" }));
    expect(result.entries[0].cost).toBeNull();
  });

  it("aggregates total tokens", () => {
    const result = calculateSessionCosts(makeSessions(
      { inputTokens: 100, outputTokens: 50 },
      { inputTokens: 200, outputTokens: 100 },
    ));
    expect(result.totalInputTokens).toBe(300);
    expect(result.totalOutputTokens).toBe(150);
  });

  it("detects cron sessions by key prefix", () => {
    const result = calculateSessionCosts(makeSessions(
      { key: "cron-abc" },
      { key: "session-xyz" },
    ));
    expect(result.entries[0].isCron).toBe(true);
    expect(result.entries[1].isCron).toBe(false);
  });

  it("groups by model display name", () => {
    const result = calculateSessionCosts(makeSessions(
      { model: "claude-opus-4" },
      { model: "anthropic/claude-opus-4-0620" },
    ));
    expect(result.costByModel.get("Opus 4")?.requests).toBe(2);
  });

  it("handles empty input", () => {
    const result = calculateSessionCosts([]);
    expect(result.entries).toEqual([]);
    expect(result.totalCost).toBe(0);
  });

  it("defaults missing tokens to 0", () => {
    const result = calculateSessionCosts([{ key: "s1", model: "claude-opus-4" }]);
    expect(result.entries[0].inputTokens).toBe(0);
    expect(result.entries[0].outputTokens).toBe(0);
  });
});

// ─── trendAggregator ─────────────────────────────────────────────────────────

describe("aggregateByDay", () => {
  const makeEntry = (date: string, cost: number): SessionCostEntry => ({
    key: "s1",
    displayName: "S1",
    model: "claude-opus-4",
    modelDisplayName: "Opus 4",
    inputTokens: 1000,
    outputTokens: 500,
    cost,
    updatedAt: new Date(date).getTime(),
    isCron: false,
  });

  it("groups entries by day", () => {
    const entries = [
      makeEntry("2026-02-25T10:00:00Z", 1),
      makeEntry("2026-02-25T14:00:00Z", 2),
      makeEntry("2026-02-24T10:00:00Z", 3),
    ];
    const result = aggregateByDay(entries);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2026-02-24");
    expect(result[0].totalCost).toBe(3);
    expect(result[1].totalCost).toBe(3); // 1 + 2
  });

  it("skips entries without updatedAt", () => {
    const entry: SessionCostEntry = {
      key: "s1", displayName: "S1", model: "x", modelDisplayName: "X",
      inputTokens: 0, outputTokens: 0, cost: 1, updatedAt: null, isCron: false,
    };
    expect(aggregateByDay([entry])).toEqual([]);
  });

  it("returns sorted ascending", () => {
    const entries = [
      makeEntry("2026-02-28T00:00:00Z", 1),
      makeEntry("2026-02-20T00:00:00Z", 1),
    ];
    const result = aggregateByDay(entries);
    expect(result[0].date < result[1].date).toBe(true);
  });
});

describe("filterByTimeRange", () => {
  const now = new Date("2026-02-25T12:00:00Z").getTime();
  const makeEntry = (hoursAgo: number): SessionCostEntry => ({
    key: "s1", displayName: "S1", model: "x", modelDisplayName: "X",
    inputTokens: 0, outputTokens: 0, cost: 0,
    updatedAt: now - hoursAgo * 3600_000,
    isCron: false,
  });

  it("today filters last 24h", () => {
    const entries = [makeEntry(12), makeEntry(36)];
    expect(filterByTimeRange(entries, "today", now)).toHaveLength(1);
  });

  it("7d filters last 7 days", () => {
    const entries = [makeEntry(24), makeEntry(24 * 8)];
    expect(filterByTimeRange(entries, "7d", now)).toHaveLength(1);
  });

  it("all returns everything", () => {
    const entries = [makeEntry(24 * 365)];
    expect(filterByTimeRange(entries, "all", now)).toHaveLength(1);
  });
});
