import { describe, it, expect } from "vitest";
import {
  isRecord,
  coerceString,
  coerceStringOrEmpty,
  coerceBoolean,
  coerceNumber,
  parseString,
  parseNumber,
  parseStringList,
} from "@/lib/type-guards";

describe("isRecord", () => {
  it("returns true for plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });
  it("returns false for arrays", () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
  });
  it("returns false for null/undefined/primitives", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord("string")).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});

describe("coerceString", () => {
  it("trims and returns strings", () => {
    expect(coerceString("hello")).toBe("hello");
    expect(coerceString("  spaced  ")).toBe("spaced");
  });
  it("returns undefined for non-strings", () => {
    expect(coerceString(42)).toBeUndefined();
    expect(coerceString(null)).toBeUndefined();
    expect(coerceString(undefined)).toBeUndefined();
    expect(coerceString(true)).toBeUndefined();
  });
});

describe("coerceStringOrEmpty", () => {
  it("trims and returns strings", () => {
    expect(coerceStringOrEmpty("hello")).toBe("hello");
  });
  it("returns empty string for non-strings", () => {
    expect(coerceStringOrEmpty(42)).toBe("");
    expect(coerceStringOrEmpty(null)).toBe("");
  });
});

describe("coerceBoolean", () => {
  it("returns booleans", () => {
    expect(coerceBoolean(true)).toBe(true);
    expect(coerceBoolean(false)).toBe(false);
  });
  it("returns undefined for non-booleans", () => {
    expect(coerceBoolean(1)).toBeUndefined();
    expect(coerceBoolean("true")).toBeUndefined();
  });
});

describe("coerceNumber", () => {
  it("returns finite numbers", () => {
    expect(coerceNumber(42)).toBe(42);
    expect(coerceNumber(0)).toBe(0);
    expect(coerceNumber(-3.14)).toBe(-3.14);
  });
  it("rejects non-finite numbers", () => {
    expect(coerceNumber(Infinity)).toBeUndefined();
    expect(coerceNumber(NaN)).toBeUndefined();
  });
  it("returns undefined for non-numbers", () => {
    expect(coerceNumber("42")).toBeUndefined();
    expect(coerceNumber(null)).toBeUndefined();
  });
});

describe("parseString", () => {
  it("returns trimmed non-empty strings", () => {
    expect(parseString("hello")).toBe("hello");
    expect(parseString("  spaced  ")).toBe("spaced");
  });
  it("returns null for empty or whitespace strings", () => {
    expect(parseString("")).toBeNull();
    expect(parseString("   ")).toBeNull();
  });
  it("returns null for non-strings", () => {
    expect(parseString(42)).toBeNull();
    expect(parseString(null)).toBeNull();
  });
});

describe("parseNumber", () => {
  it("returns finite numbers", () => {
    expect(parseNumber(42)).toBe(42);
  });
  it("returns null for non-finite/non-numbers", () => {
    expect(parseNumber(NaN)).toBeNull();
    expect(parseNumber("42")).toBeNull();
  });
});

describe("parseStringList", () => {
  it("filters and trims string arrays", () => {
    expect(parseStringList(["a", " b ", "c"])).toEqual(["a", "b", "c"]);
  });
  it("filters out non-strings and empty strings", () => {
    expect(parseStringList(["a", 42, "", null, "b"])).toEqual(["a", "b"]);
  });
  it("returns empty array for non-arrays", () => {
    expect(parseStringList("not an array")).toEqual([]);
    expect(parseStringList(null)).toEqual([]);
  });
});
