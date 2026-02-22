import { describe, it, expect } from "vitest";

import {
  readString,
  readNumber,
  readObjectArray,
  getDescriptionPreview,
  formatTimestamp,
  formatTimestampOrFallback,
  PRIORITY_LEVELS,
} from "@/features/task-control-plane/lib/utils";

describe("readString", () => {
  it("returns first matching string key", () => {
    expect(readString({ a: "hello", b: "world" }, ["a", "b"])).toBe("hello");
  });
  it("skips empty strings", () => {
    expect(readString({ a: "", b: "found" }, ["a", "b"])).toBe("found");
  });
  it("returns null for missing keys", () => {
    expect(readString({ a: 42 }, ["a"])).toBeNull();
  });
  it("returns null for null record", () => {
    expect(readString(null, ["a"])).toBeNull();
  });
  it("trims whitespace", () => {
    expect(readString({ a: "  hi  " }, ["a"])).toBe("hi");
  });
});

describe("readNumber", () => {
  it("returns first matching number", () => {
    expect(readNumber({ a: 5 }, ["a"])).toBe(5);
  });
  it("returns null for NaN", () => {
    expect(readNumber({ a: NaN }, ["a"])).toBeNull();
  });
  it("returns null for Infinity", () => {
    expect(readNumber({ a: Infinity }, ["a"])).toBeNull();
  });
  it("returns null for null record", () => {
    expect(readNumber(null, ["a"])).toBeNull();
  });
  it("returns zero", () => {
    expect(readNumber({ a: 0 }, ["a"])).toBe(0);
  });
});

describe("readObjectArray", () => {
  it("returns array of objects", () => {
    const result = readObjectArray({ items: [{ x: 1 }, { y: 2 }] }, ["items"]);
    expect(result).toHaveLength(2);
  });
  it("filters non-objects", () => {
    const result = readObjectArray({ items: [{ x: 1 }, null, "str", 42] }, ["items"]);
    expect(result).toHaveLength(1);
  });
  it("returns empty for null record", () => {
    expect(readObjectArray(null, ["items"])).toEqual([]);
  });
  it("returns empty for non-array value", () => {
    expect(readObjectArray({ items: "not array" }, ["items"])).toEqual([]);
  });
  it("tries multiple keys", () => {
    const result = readObjectArray({ deps: [{ a: 1 }] }, ["items", "deps"]);
    expect(result).toHaveLength(1);
  });
});

describe("getDescriptionPreview", () => {
  it("returns first non-empty line", () => {
    expect(getDescriptionPreview("\n  Hello world\n  Second line")).toBe("Hello world");
  });
  it("truncates at 140 chars", () => {
    const long = "A".repeat(200);
    const result = getDescriptionPreview(long);
    expect(result.length).toBe(143); // 140 + "..."
    expect(result.endsWith("...")).toBe(true);
  });
  it("returns empty for blank input", () => {
    expect(getDescriptionPreview("   \n   ")).toBe("");
  });
  it("does not truncate short lines", () => {
    expect(getDescriptionPreview("Short")).toBe("Short");
  });
});

describe("formatTimestamp", () => {
  it("formats valid ISO date", () => {
    const result = formatTimestamp("2026-01-15T10:30:00Z");
    expect(result).toBeTruthy();
    expect(result).not.toBe("2026-01-15T10:30:00Z"); // should be locale-formatted
  });
  it("returns raw value for invalid date", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("formatTimestampOrFallback", () => {
  it("returns fallback for null", () => {
    expect(formatTimestampOrFallback(null)).toBe("Unknown");
  });
  it("returns custom fallback", () => {
    expect(formatTimestampOrFallback(null, "N/A")).toBe("N/A");
  });
  it("formats valid value", () => {
    const result = formatTimestampOrFallback("2026-01-15T10:30:00Z");
    expect(result).not.toBe("Unknown");
  });
});

describe("PRIORITY_LEVELS", () => {
  it("has 5 entries from 0 to 4", () => {
    expect(PRIORITY_LEVELS).toHaveLength(5);
    expect(PRIORITY_LEVELS[0].value).toBe(0);
    expect(PRIORITY_LEVELS[4].value).toBe(4);
  });
});
