import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime } from "@/lib/text/time";

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function at(offsetMs: number): number {
    return Date.now() - offsetMs;
  }

  it('returns "just now" for timestamps less than 5s ago', () => {
    expect(formatRelativeTime(at(0))).toBe("just now");
    expect(formatRelativeTime(at(4_000))).toBe("just now");
  });

  it("returns seconds for 5-59s ago", () => {
    expect(formatRelativeTime(at(5_000))).toBe("5s ago");
    expect(formatRelativeTime(at(30_000))).toBe("30s ago");
    expect(formatRelativeTime(at(59_000))).toBe("59s ago");
  });

  it("returns minutes for 1-59 minutes", () => {
    expect(formatRelativeTime(at(60_000))).toBe("1m ago");
    expect(formatRelativeTime(at(5 * 60_000))).toBe("5m ago");
    expect(formatRelativeTime(at(59 * 60_000))).toBe("59m ago");
  });

  it("returns hours for 1-23 hours", () => {
    expect(formatRelativeTime(at(60 * 60_000))).toBe("1h ago");
    expect(formatRelativeTime(at(12 * 60 * 60_000))).toBe("12h ago");
    expect(formatRelativeTime(at(23 * 60 * 60_000))).toBe("23h ago");
  });

  it("returns days for 24h+", () => {
    expect(formatRelativeTime(at(24 * 60 * 60_000))).toBe("1d ago");
    expect(formatRelativeTime(at(7 * 24 * 60 * 60_000))).toBe("7d ago");
  });

  it('returns "—" for null/undefined', () => {
    expect(formatRelativeTime(null)).toBe("—");
    expect(formatRelativeTime(undefined)).toBe("—");
  });

  it("handles future timestamps", () => {
    // Use 61s to avoid flaky boundary (execution time can consume ~1s)
    expect(formatRelativeTime(Date.now() + 61_000)).toBe("in 1m");
  });
});
