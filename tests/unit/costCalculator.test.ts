import { describe, it, expect } from "vitest";
import {
  calculateSessionCosts,
  type RawSessionEntry,
} from "@/features/usage/lib/costCalculator";

describe("calculateSessionCosts", () => {
  it("calculates cost for known Opus model", () => {
    const sessions: RawSessionEntry[] = [
      {
        key: "session-1",
        model: "anthropic/claude-opus-4-0620",
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        updatedAt: Date.now(),
      },
    ];
    const result = calculateSessionCosts(sessions);
    // Input: 1M * $15/1M = $15, Output: 100K * $75/1M = $7.50
    expect(result.totalCost).toBeCloseTo(22.5);
    expect(result.entries[0].cost).toBeCloseTo(22.5);
    expect(result.entries[0].modelDisplayName).toBe("Opus 4");
  });

  it("calculates cost for Sonnet model", () => {
    const sessions: RawSessionEntry[] = [
      {
        key: "session-2",
        model: "claude-sonnet-4-0514",
        inputTokens: 2_000_000,
        outputTokens: 500_000,
        updatedAt: Date.now(),
      },
    ];
    const result = calculateSessionCosts(sessions);
    // Input: 2M * $3/1M = $6, Output: 500K * $15/1M = $7.50
    expect(result.totalCost).toBeCloseTo(13.5);
  });

  it("returns null cost for unknown model", () => {
    const sessions: RawSessionEntry[] = [
      {
        key: "session-3",
        model: "gpt-4o",
        inputTokens: 1000,
        outputTokens: 500,
        updatedAt: Date.now(),
      },
    ];
    const result = calculateSessionCosts(sessions);
    expect(result.entries[0].cost).toBeNull();
    // totalCost should be 0 since unknown model doesn't contribute
    expect(result.totalCost).toBe(0);
  });

  it("detects cron sessions by key prefix", () => {
    const sessions: RawSessionEntry[] = [
      { key: "cron-abc123-1234567890", model: "claude-opus-4" },
      { key: "main", model: "claude-opus-4" },
    ];
    const result = calculateSessionCosts(sessions);
    expect(result.entries[0].isCron).toBe(true);
    expect(result.entries[1].isCron).toBe(false);
  });

  it("handles empty input", () => {
    const result = calculateSessionCosts([]);
    expect(result.entries).toEqual([]);
    expect(result.totalCost).toBe(0);
    expect(result.costByModel.size).toBe(0);
    expect(result.totalInputTokens).toBe(0);
    expect(result.totalOutputTokens).toBe(0);
  });

  it("aggregates by model display name", () => {
    const sessions: RawSessionEntry[] = [
      { key: "s1", model: "anthropic/claude-opus-4-0620", inputTokens: 100, outputTokens: 50 },
      { key: "s2", model: "claude-opus-4", inputTokens: 200, outputTokens: 100 },
    ];
    const result = calculateSessionCosts(sessions);
    const opusBreakdown = result.costByModel.get("Opus 4");
    expect(opusBreakdown).toBeDefined();
    expect(opusBreakdown!.requests).toBe(2);
    expect(opusBreakdown!.inputTokens).toBe(300);
    expect(opusBreakdown!.outputTokens).toBe(150);
  });

  it("handles missing token fields gracefully", () => {
    const sessions: RawSessionEntry[] = [
      { key: "s1", model: "claude-opus-4" },
    ];
    const result = calculateSessionCosts(sessions);
    expect(result.entries[0].inputTokens).toBe(0);
    expect(result.entries[0].outputTokens).toBe(0);
    expect(result.entries[0].cost).toBeCloseTo(0);
  });
});
