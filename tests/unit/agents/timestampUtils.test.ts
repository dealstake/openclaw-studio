import { describe, it, expect } from "vitest";
import { toTimestampMs, extractMessageTimestamp } from "@/features/agents/state/timestampUtils";

describe("toTimestampMs", () => {
  it("returns number if positive and finite", () => {
    expect(toTimestampMs(1708473600000)).toBe(1708473600000);
  });

  it("returns null for 0", () => {
    expect(toTimestampMs(0)).toBeNull();
  });

  it("returns null for negative numbers", () => {
    expect(toTimestampMs(-1)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(toTimestampMs(NaN)).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(toTimestampMs(Infinity)).toBeNull();
  });

  it("parses ISO date strings", () => {
    const result = toTimestampMs("2026-02-20T12:00:00Z");
    expect(result).toBe(Date.parse("2026-02-20T12:00:00Z"));
  });

  it("returns null for invalid date strings", () => {
    expect(toTimestampMs("not-a-date")).toBeNull();
  });

  it("returns null for non-number non-string values", () => {
    expect(toTimestampMs(null)).toBeNull();
    expect(toTimestampMs(undefined)).toBeNull();
    expect(toTimestampMs({})).toBeNull();
    expect(toTimestampMs(true)).toBeNull();
  });
});

describe("extractMessageTimestamp", () => {
  it("extracts from timestamp field", () => {
    expect(extractMessageTimestamp({ timestamp: 1708473600000 })).toBe(1708473600000);
  });

  it("extracts from createdAt field", () => {
    expect(extractMessageTimestamp({ createdAt: 1708473600000 })).toBe(1708473600000);
  });

  it("extracts from at field", () => {
    expect(extractMessageTimestamp({ at: 1708473600000 })).toBe(1708473600000);
  });

  it("prefers timestamp over createdAt over at", () => {
    expect(
      extractMessageTimestamp({ timestamp: 100, createdAt: 200, at: 300 })
    ).toBe(100);
    expect(
      extractMessageTimestamp({ createdAt: 200, at: 300 })
    ).toBe(200);
  });

  it("returns null for null/undefined input", () => {
    expect(extractMessageTimestamp(null)).toBeNull();
    expect(extractMessageTimestamp(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(extractMessageTimestamp("string")).toBeNull();
    expect(extractMessageTimestamp(42)).toBeNull();
  });

  it("returns null if no timestamp fields present", () => {
    expect(extractMessageTimestamp({ foo: "bar" })).toBeNull();
  });

  it("handles string timestamps in message objects", () => {
    const result = extractMessageTimestamp({ timestamp: "2026-02-20T12:00:00Z" });
    expect(result).toBe(Date.parse("2026-02-20T12:00:00Z"));
  });
});
