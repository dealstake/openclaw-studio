import { describe, it, expect } from "vitest";
import { formatDuration } from "@/lib/text/time";

describe("formatDuration", () => {
  it("formats sub-second durations as milliseconds", () => {
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(450)).toBe("450ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formats seconds with one decimal", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(3200)).toBe("3.2s");
    expect(formatDuration(59999)).toBe("60.0s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(60_000)).toBe("1m 0s");
    expect(formatDuration(135_000)).toBe("2m 15s");
    expect(formatDuration(600_000)).toBe("10m 0s");
  });
});
