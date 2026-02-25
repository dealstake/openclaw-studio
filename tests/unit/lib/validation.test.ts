import { describe, it, expect } from "vitest";
import { resolveRequiredId } from "@/lib/validation";

describe("resolveRequiredId", () => {
  it("returns trimmed value", () => {
    expect(resolveRequiredId("  abc  ", "id")).toBe("abc");
  });

  it("throws on empty string", () => {
    expect(() => resolveRequiredId("", "Agent id")).toThrow("Agent id is required.");
  });

  it("throws on whitespace-only string", () => {
    expect(() => resolveRequiredId("   ", "Job id")).toThrow("Job id is required.");
  });

  it("includes label in error message", () => {
    expect(() => resolveRequiredId("", "Custom label")).toThrow("Custom label is required.");
  });
});
