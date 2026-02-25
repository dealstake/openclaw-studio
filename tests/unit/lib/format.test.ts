import { describe, it, expect } from "vitest";
import { formatCost, formatTokens, formatSize, formatSizeFromString } from "@/lib/text/format";

describe("formatCost", () => {
  it("returns <$0.01 for tiny amounts", () => {
    expect(formatCost(0)).toBe("<$0.01");
    expect(formatCost(0.001)).toBe("<$0.01");
    expect(formatCost(0.009)).toBe("<$0.01");
  });

  it("formats normal costs with 2 decimals", () => {
    expect(formatCost(1.5)).toBe("$1.50");
    expect(formatCost(0.01)).toBe("$0.01");
    expect(formatCost(99.99)).toBe("$99.99");
  });

  it("formats large numbers", () => {
    expect(formatCost(1234.56)).toBe("$1,234.56");
  });

  it("respects currency parameter", () => {
    const result = formatCost(10, "EUR");
    expect(result).toContain("10");
  });

  it("falls back to USD for empty currency", () => {
    expect(formatCost(1, "")).toBe("$1.00");
  });
});

describe("formatTokens", () => {
  it("formats small numbers without suffix", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
  });

  it("formats thousands with K suffix", () => {
    expect(formatTokens(1000)).toBe("1.0K");
    expect(formatTokens(1500)).toBe("1.5K");
    expect(formatTokens(999999)).toBe("1000.0K");
  });

  it("formats millions with M suffix", () => {
    expect(formatTokens(1000000)).toBe("1.0M");
    expect(formatTokens(2500000)).toBe("2.5M");
  });
});

describe("formatSize", () => {
  it("returns empty string for undefined", () => {
    expect(formatSize(undefined)).toBe("");
  });

  it("formats bytes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatSize(1024)).toBe("1.0 KB");
    expect(formatSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });
});

describe("formatSizeFromString", () => {
  it("returns dash for falsy input", () => {
    expect(formatSizeFromString(undefined)).toBe("—");
    expect(formatSizeFromString("")).toBe("—");
  });

  it("returns dash for NaN", () => {
    expect(formatSizeFromString("abc")).toBe("—");
  });

  it("formats valid numeric strings", () => {
    expect(formatSizeFromString("1024")).toBe("1.0 KB");
    expect(formatSizeFromString("512")).toBe("512 B");
  });
});
