import { describe, it, expect, vi, afterEach } from "vitest";
import { formatDuration, formatDurationCompact, formatElapsedLabel, formatRelativeTime } from "@/lib/text/time";

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(450)).toBe("450ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(3200)).toBe("3.2s");
    expect(formatDuration(59999)).toBe("60.0s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(60000)).toBe("1m 0s");
    expect(formatDuration(135000)).toBe("2m 15s");
    expect(formatDuration(3600000)).toBe("60m 0s");
  });
});

describe("formatDurationCompact", () => {
  it("returns dash for undefined", () => {
    expect(formatDurationCompact(undefined)).toBe("—");
  });

  it("formats milliseconds", () => {
    expect(formatDurationCompact(500)).toBe("500ms");
  });

  it("formats seconds compactly", () => {
    expect(formatDurationCompact(3500)).toBe("3.5s");
  });

  it("formats minutes compactly", () => {
    expect(formatDurationCompact(90000)).toBe("1.5m");
  });
});

describe("formatElapsedLabel", () => {
  it("returns null when streaming", () => {
    expect(formatElapsedLabel(1000, 5000, true)).toBeNull();
  });

  it("returns null when timestamps are missing", () => {
    expect(formatElapsedLabel(undefined, undefined)).toBeNull();
    expect(formatElapsedLabel(1000, undefined)).toBeNull();
    expect(formatElapsedLabel(undefined, 5000)).toBeNull();
  });

  it("formats seconds", () => {
    expect(formatElapsedLabel(0, 5000)).toBe("5s");
    expect(formatElapsedLabel(0, 0)).toBe("0s");
    expect(formatElapsedLabel(0, 59000)).toBe("59s");
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsedLabel(0, 60000)).toBe("1m 00s");
    expect(formatElapsedLabel(0, 125000)).toBe("2m 05s");
    expect(formatElapsedLabel(0, 3600000)).toBe("60m 00s");
  });

  it("clamps negative durations to 0", () => {
    expect(formatElapsedLabel(5000, 1000)).toBe("0s");
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => vi.useRealTimers());

  it("returns dash for falsy input", () => {
    expect(formatRelativeTime(null)).toBe("—");
    expect(formatRelativeTime(undefined)).toBe("—");
    expect(formatRelativeTime(0)).toBe("—");
  });

  it("formats past timestamps", () => {
    const now = 1_000_000_000_000;
    vi.useFakeTimers({ now });

    expect(formatRelativeTime(now - 2000)).toBe("just now");
    expect(formatRelativeTime(now - 30_000)).toBe("30s ago");
    expect(formatRelativeTime(now - 300_000)).toBe("5m ago");
    expect(formatRelativeTime(now - 7_200_000)).toBe("2h ago");
    expect(formatRelativeTime(now - 172_800_000)).toBe("2d ago");
  });

  it("formats future timestamps", () => {
    const now = 1_000_000_000_000;
    vi.useFakeTimers({ now });

    expect(formatRelativeTime(now + 5000)).toBe("now");
    expect(formatRelativeTime(now + 30_000)).toBe("in 30s");
    expect(formatRelativeTime(now + 300_000)).toBe("in 5m");
    expect(formatRelativeTime(now + 7_200_000)).toBe("in 2h");
    expect(formatRelativeTime(now + 172_800_000)).toBe("in 2d");
  });
});
