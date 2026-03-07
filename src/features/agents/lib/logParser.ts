/**
 * logParser.ts — Agent Log Viewer & Diagnostics
 *
 * Pure utilities for parsing raw log text:
 *  - ANSI escape code stripping
 *  - Log level detection from text content
 *  - Timestamp extraction
 *  - Log line normalization
 *
 * No React imports. All functions are fully testable in isolation.
 */

import type { LogLevel, LogLine } from "./logTypes";
import { stripAnsi } from "@/lib/stripAnsi";

export { stripAnsi };

// ---------------------------------------------------------------------------
// Log level detection
// ---------------------------------------------------------------------------

/**
 * Detect the log level from log text content.
 * Checks for common structured (JSON) and unstructured patterns.
 */
export function detectLogLevel(text: string): LogLevel {
  const normalized = text.toLowerCase();

  // Fast path: check for common prefixes / keywords first
  if (
    normalized.includes('"level":"error"') ||
    normalized.includes('"level": "error"') ||
    normalized.includes("[error]") ||
    normalized.includes("error:") ||
    /\berror\b/.test(normalized.slice(0, 20)) // starts with "error"
  ) {
    return "error";
  }

  if (
    normalized.includes('"level":"warn"') ||
    normalized.includes('"level": "warn"') ||
    normalized.includes("[warn]") ||
    normalized.includes("[warning]") ||
    normalized.includes("warn:") ||
    /\bwarn\b/.test(normalized.slice(0, 20))
  ) {
    return "warn";
  }

  if (
    normalized.includes('"level":"debug"') ||
    normalized.includes('"level": "debug"') ||
    normalized.includes("[debug]") ||
    normalized.includes("debug:") ||
    /\bdebug\b/.test(normalized.slice(0, 20))
  ) {
    return "debug";
  }

  if (
    normalized.includes('"level":"trace"') ||
    normalized.includes('"level": "trace"') ||
    normalized.includes("[trace]") ||
    normalized.includes("trace:") ||
    /\btrace\b/.test(normalized.slice(0, 20))
  ) {
    return "trace";
  }

  if (
    normalized.includes('"level":"info"') ||
    normalized.includes('"level": "info"') ||
    normalized.includes("[info]") ||
    normalized.includes("info:") ||
    /\binfo\b/.test(normalized.slice(0, 20))
  ) {
    return "info";
  }

  return "unknown";
}

// ---------------------------------------------------------------------------
// Timestamp extraction
// ---------------------------------------------------------------------------

/** ISO 8601 timestamp pattern (at start of line or in JSON "time"/"ts" key). */
const ISO_TS_RE = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/;

/**
 * Attempt to extract a Unix ms timestamp from log text.
 * Returns null if no recognizable timestamp is found.
 */
export function extractLogTimestamp(text: string): number | null {
  const match = ISO_TS_RE.exec(text);
  if (!match) return null;
  const parsed = Date.parse(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// Log line normalization
// ---------------------------------------------------------------------------

let _seqCounter = 0;

/** Reset the sequence counter (for testing only). */
export function _resetSeqCounter(): void {
  _seqCounter = 0;
}

/**
 * Normalize a raw log string into a structured LogLine.
 * Assigns a monotonically-increasing seq number.
 *
 * @param raw   Raw log text (may contain ANSI codes).
 * @param source Optional source label (e.g. "gateway", "agent:alex").
 * @param now   Override for the current timestamp (for testing).
 */
export function normalizeLogLine(
  raw: string,
  source?: string,
  now: number = Date.now(),
): LogLine {
  const text = stripAnsi(raw).trim();
  const level = detectLogLevel(text);
  const ts = extractLogTimestamp(text) ?? now;

  return {
    seq: ++_seqCounter,
    ts,
    level,
    raw,
    text,
    source,
  };
}

// ---------------------------------------------------------------------------
// Log filtering
// ---------------------------------------------------------------------------

/**
 * Filter a set of log lines by log level.
 * "error" shows only errors; "warn" shows warn+error; "info" shows all named levels; "debug"/"trace" shows everything.
 */
export function filterByLevel(lines: LogLine[], minLevel: LogLevel): LogLine[] {
  // Permissive levels: show everything including unknown
  if (minLevel === "trace" || minLevel === "debug" || minLevel === "unknown") {
    return lines;
  }

  // Strict order: error (0) → warn (1) → info (2) → debug (3) → trace (4) → unknown (5)
  // "info" minLevel shows error + warn + info. "unknown" (idx 5) is excluded unless minLevel
  // is permissive (handled above). This gives strict, predictable filtering.
  const levelOrder: LogLevel[] = ["error", "warn", "info", "debug", "trace", "unknown"];
  const minIdx = levelOrder.indexOf(minLevel);
  if (minIdx < 0) return lines;

  return lines.filter((line) => {
    const idx = levelOrder.indexOf(line.level);
    if (idx < 0) return false;
    return idx <= minIdx;
  });
}

/**
 * Full-text search within log lines.
 * Case-insensitive match on the cleaned text.
 */
export function searchLogLines(lines: LogLine[], query: string): LogLine[] {
  if (!query.trim()) return lines;
  const lower = query.toLowerCase();
  return lines.filter((line) => line.text.toLowerCase().includes(lower));
}
