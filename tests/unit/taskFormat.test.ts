import { describe, expect, it } from "vitest";
import { formatDuration } from "@/features/tasks/lib/format";

describe("formatDuration", () => {
  it("returns dash for undefined", () => {
    expect(formatDuration(undefined)).toBe("—");
  });

  it("formats milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(3500)).toBe("3.5s");
  });

  it("formats minutes", () => {
    expect(formatDuration(90000)).toBe("1.5m");
  });

  it("formats exactly 1 second", () => {
    expect(formatDuration(1000)).toBe("1.0s");
  });

  it("formats exactly 1 minute", () => {
    expect(formatDuration(60000)).toBe("1.0m");
  });
});
