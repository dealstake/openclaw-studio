import { describe, it, expect, beforeEach } from "vitest";
import {
  stripAnsi,
  detectLogLevel,
  extractLogTimestamp,
  normalizeLogLine,
  filterByLevel,
  searchLogLines,
  _resetSeqCounter,
} from "@/features/agents/lib/logParser";
import type { LogLine } from "@/features/agents/lib/logTypes";

// Reset seq counter before each test for deterministic seq numbers
beforeEach(() => {
  _resetSeqCounter();
});

// ---------------------------------------------------------------------------
// stripAnsi
// ---------------------------------------------------------------------------

describe("stripAnsi", () => {
  it("strips basic color codes", () => {
    expect(stripAnsi("\x1B[32mHello\x1B[0m")).toBe("Hello");
  });

  it("strips bold + color", () => {
    expect(stripAnsi("\x1B[1;31mError\x1B[0m")).toBe("Error");
  });

  it("returns plain strings unchanged", () => {
    expect(stripAnsi("plain text")).toBe("plain text");
  });

  it("strips multiple codes in one string", () => {
    expect(stripAnsi("\x1B[33mwarn\x1B[0m: something \x1B[31mbad\x1B[0m")).toBe("warn: something bad");
  });

  it("handles empty string", () => {
    expect(stripAnsi("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// detectLogLevel
// ---------------------------------------------------------------------------

describe("detectLogLevel", () => {
  it("detects [ERROR] prefix", () => {
    expect(detectLogLevel("[ERROR] something went wrong")).toBe("error");
  });

  it("detects [WARN] prefix", () => {
    expect(detectLogLevel("[WARN] watch out")).toBe("warn");
  });

  it("detects [INFO] prefix", () => {
    expect(detectLogLevel("[INFO] started server")).toBe("info");
  });

  it("detects [DEBUG] prefix", () => {
    expect(detectLogLevel("[DEBUG] handler called")).toBe("debug");
  });

  it("detects JSON level field", () => {
    expect(detectLogLevel('{"level":"error","msg":"oops"}')).toBe("error");
    expect(detectLogLevel('{"level": "warn","msg":"watch"}')).toBe("warn");
    expect(detectLogLevel('{"level":"info","msg":"ok"}')).toBe("info");
  });

  it('returns "unknown" for unrecognized text', () => {
    expect(detectLogLevel("Starting up...")).toBe("unknown");
  });

  it("is case-insensitive", () => {
    expect(detectLogLevel("[Error] oops")).toBe("error");
    expect(detectLogLevel("[WARNING] careful")).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// extractLogTimestamp
// ---------------------------------------------------------------------------

describe("extractLogTimestamp", () => {
  it("extracts ISO timestamp from log line", () => {
    const ts = extractLogTimestamp("2026-03-01T10:00:00.000Z agent started");
    expect(ts).toBe(Date.parse("2026-03-01T10:00:00.000Z"));
  });

  it("returns null for lines without timestamp", () => {
    expect(extractLogTimestamp("no timestamp here")).toBeNull();
  });

  it("extracts timestamp from JSON log", () => {
    const ts = extractLogTimestamp('{"time":"2026-03-01T12:00:00Z","msg":"ok"}');
    expect(ts).toBe(Date.parse("2026-03-01T12:00:00Z"));
  });
});

// ---------------------------------------------------------------------------
// normalizeLogLine
// ---------------------------------------------------------------------------

describe("normalizeLogLine", () => {
  it("assigns monotonically increasing seq numbers", () => {
    const a = normalizeLogLine("line 1", undefined, 1000);
    const b = normalizeLogLine("line 2", undefined, 1000);
    expect(b.seq).toBe(a.seq + 1);
  });

  it("strips ANSI from raw text", () => {
    const line = normalizeLogLine("\x1B[32mHello\x1B[0m", undefined, 1000);
    expect(line.text).toBe("Hello");
    expect(line.raw).toBe("\x1B[32mHello\x1B[0m");
  });

  it("detects level from cleaned text", () => {
    const line = normalizeLogLine("[ERROR] something failed", undefined, 1000);
    expect(line.level).toBe("error");
  });

  it("uses provided source", () => {
    const line = normalizeLogLine("starting", "gateway", 1000);
    expect(line.source).toBe("gateway");
  });

  it("falls back to provided now when no embedded timestamp", () => {
    const line = normalizeLogLine("no timestamp", undefined, 9999);
    expect(line.ts).toBe(9999);
  });
});

// ---------------------------------------------------------------------------
// filterByLevel
// ---------------------------------------------------------------------------

describe("filterByLevel", () => {
  const makeLines = (): LogLine[] => {
    _resetSeqCounter();
    return [
      normalizeLogLine("[ERROR] crash", undefined, 1),
      normalizeLogLine("[WARN] slow", undefined, 2),
      normalizeLogLine("[INFO] ok", undefined, 3),
      normalizeLogLine("[DEBUG] verbose", undefined, 4),
      normalizeLogLine("plain output", undefined, 5), // unknown
    ];
  };

  it("error level returns only errors", () => {
    const result = filterByLevel(makeLines(), "error");
    expect(result.every((l) => l.level === "error")).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("warn level returns errors and warnings", () => {
    const result = filterByLevel(makeLines(), "warn");
    expect(result.map((l) => l.level)).toEqual(
      expect.arrayContaining(["error", "warn"]),
    );
    expect(result.every((l) => l.level === "error" || l.level === "warn")).toBe(true);
  });

  it("info level returns error + warn + info (not debug)", () => {
    const result = filterByLevel(makeLines(), "info");
    const levels = result.map((l) => l.level);
    expect(levels).toContain("error");
    expect(levels).toContain("warn");
    expect(levels).toContain("info");
    expect(levels).not.toContain("debug");
  });

  it("debug passes all named levels through", () => {
    const result = filterByLevel(makeLines(), "debug");
    expect(result).toHaveLength(makeLines().length);
  });

  it("unknown passes all lines through", () => {
    const result = filterByLevel(makeLines(), "unknown");
    expect(result).toHaveLength(makeLines().length);
  });
});

// ---------------------------------------------------------------------------
// searchLogLines
// ---------------------------------------------------------------------------

describe("searchLogLines", () => {
  const lines: LogLine[] = [
    { seq: 1, ts: 1, level: "info", raw: "server started on port 3000", text: "server started on port 3000" },
    { seq: 2, ts: 2, level: "error", raw: "connection refused", text: "connection refused" },
    { seq: 3, ts: 3, level: "warn", raw: "timeout warning", text: "timeout warning" },
  ];

  it("returns all lines for empty query", () => {
    expect(searchLogLines(lines, "")).toHaveLength(3);
    expect(searchLogLines(lines, "   ")).toHaveLength(3);
  });

  it("filters by case-insensitive substring", () => {
    const result = searchLogLines(lines, "CONNECTION");
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("connection refused");
  });

  it("returns empty array when no match", () => {
    expect(searchLogLines(lines, "xyz123")).toHaveLength(0);
  });

  it("matches partial text", () => {
    const result = searchLogLines(lines, "port");
    expect(result).toHaveLength(1);
  });
});
