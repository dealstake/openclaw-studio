import { describe, expect, it } from "vitest";
import { formatDurationCompact } from "@/lib/text/time";

describe("formatDurationCompact", () => {
  it("returns dash for undefined", () => {
    expect(formatDurationCompact(undefined)).toBe("—");
  });

  it("formats milliseconds", () => {
    expect(formatDurationCompact(500)).toBe("500ms");
  });

  it("formats seconds", () => {
    expect(formatDurationCompact(3500)).toBe("3.5s");
  });

  it("formats minutes", () => {
    expect(formatDurationCompact(90000)).toBe("1.5m");
  });

  it("formats exactly 1 second", () => {
    expect(formatDurationCompact(1000)).toBe("1.0s");
  });

  it("formats exactly 1 minute", () => {
    expect(formatDurationCompact(60000)).toBe("1.0m");
  });
});
