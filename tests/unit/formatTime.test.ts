import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelativeTime } from "@/features/notifications/lib/formatTime";

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function at(offsetMs: number): number {
    // Return a timestamp that is `offsetMs` in the past
    return Date.now() - offsetMs;
  }

  it('returns "just now" for timestamps less than 60s ago', () => {
    expect(formatRelativeTime(at(0))).toBe("just now");
    expect(formatRelativeTime(at(30_000))).toBe("just now");
    expect(formatRelativeTime(at(59_000))).toBe("just now");
  });

  it('returns "just now" for future timestamps', () => {
    expect(formatRelativeTime(Date.now() + 60_000)).toBe("just now");
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

  it("returns days for 1-29 days", () => {
    expect(formatRelativeTime(at(24 * 60 * 60_000))).toBe("1d ago");
    expect(formatRelativeTime(at(7 * 24 * 60 * 60_000))).toBe("7d ago");
    expect(formatRelativeTime(at(29 * 24 * 60 * 60_000))).toBe("29d ago");
  });

  it("returns months for 30+ days", () => {
    expect(formatRelativeTime(at(30 * 24 * 60 * 60_000))).toBe("1mo ago");
    expect(formatRelativeTime(at(90 * 24 * 60 * 60_000))).toBe("3mo ago");
  });
});
