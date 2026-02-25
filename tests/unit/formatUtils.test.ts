import { describe, it, expect } from "vitest";
import { formatCost, formatTokens } from "@/lib/text/format";

describe("formatCost", () => {
  it("formats costs >= $0.01", () => {
    expect(formatCost(1.5, "USD")).toContain("1.50");
  });

  it("returns <$0.01 for tiny costs", () => {
    expect(formatCost(0.001, "USD")).toBe("<$0.01");
    expect(formatCost(0, "USD")).toBe("<$0.01");
  });

  it("uses provided currency", () => {
    const result = formatCost(10, "EUR");
    expect(result).toContain("10");
  });

  it("defaults to USD when currency is empty", () => {
    const result = formatCost(5, "");
    expect(result).toContain("5.00");
  });
});

describe("formatTokens", () => {
  it("formats small numbers with locale string", () => {
    expect(formatTokens(500)).toBe("500");
  });

  it("formats thousands with K suffix", () => {
    expect(formatTokens(1500)).toBe("1.5K");
    expect(formatTokens(10000)).toBe("10.0K");
  });

  it("formats millions with M suffix", () => {
    expect(formatTokens(1_500_000)).toBe("1.5M");
    expect(formatTokens(2_000_000)).toBe("2.0M");
  });
});
