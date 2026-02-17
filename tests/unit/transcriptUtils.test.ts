import { describe, expect, it } from "vitest";
import {
  inferTranscriptType,
  formatTranscriptDisplayName,
  splitByQuery,
  TRANSCRIPT_TYPE_LABELS,
  TRANSCRIPT_TYPE_COLORS,
} from "@/features/sessions/lib/transcriptUtils";
import type { TranscriptEntry } from "@/features/sessions/hooks/useTranscripts";

function makeEntry(overrides: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return {
    sessionId: "ABC123",
    sessionKey: null,
    archived: false,
    size: 1024,
    startedAt: null,
    updatedAt: null,
    model: null,
    preview: null,
    ...overrides,
  };
}

/* ─── inferTranscriptType ─── */
describe("inferTranscriptType", () => {
  it("returns 'main' for sessionKey ending in :main", () => {
    expect(inferTranscriptType(makeEntry({ sessionKey: "alex:session:main" }))).toBe("main");
  });

  it("returns 'main' case-insensitive", () => {
    expect(inferTranscriptType(makeEntry({ sessionKey: "alex:session:MAIN" }))).toBe("main");
  });

  it("returns 'cron' for sessionKey containing :cron:", () => {
    expect(inferTranscriptType(makeEntry({ sessionKey: "alex:cron:abc123" }))).toBe("cron");
  });

  it("returns 'cron' for sessionKey starting with cron:", () => {
    expect(inferTranscriptType(makeEntry({ sessionKey: "cron:heartbeat" }))).toBe("cron");
  });

  it("returns 'subagent' for sessionKey containing :subagent:", () => {
    expect(inferTranscriptType(makeEntry({ sessionKey: "alex:subagent:task1" }))).toBe("subagent");
  });

  it("returns 'channel' for sessionKey starting with a known channel type", () => {
    expect(inferTranscriptType(makeEntry({ sessionKey: "telegram:12345" }))).toBe("channel");
    expect(inferTranscriptType(makeEntry({ sessionKey: "discord:guild:chan" }))).toBe("channel");
    expect(inferTranscriptType(makeEntry({ sessionKey: "googlechat:space" }))).toBe("channel");
    expect(inferTranscriptType(makeEntry({ sessionKey: "slack:channel" }))).toBe("channel");
  });

  it("returns 'unknown' for unrecognized sessionKey", () => {
    expect(inferTranscriptType(makeEntry({ sessionKey: "random:key:here" }))).toBe("unknown");
  });

  it("infers 'cron' from preview content when no sessionKey", () => {
    expect(inferTranscriptType(makeEntry({ preview: "Running cron job..." }))).toBe("cron");
    expect(inferTranscriptType(makeEntry({ preview: "Heartbeat check" }))).toBe("cron");
  });

  it("infers 'subagent' from preview content when no sessionKey", () => {
    expect(inferTranscriptType(makeEntry({ preview: "Sub-agent started" }))).toBe("subagent");
    expect(inferTranscriptType(makeEntry({ preview: "subagent task" }))).toBe("subagent");
  });

  it("returns 'unknown' when no sessionKey and no recognizable preview", () => {
    expect(inferTranscriptType(makeEntry())).toBe("unknown");
    expect(inferTranscriptType(makeEntry({ preview: "Hello world" }))).toBe("unknown");
  });
});

/* ─── formatTranscriptDisplayName ─── */
describe("formatTranscriptDisplayName", () => {
  const mockHumanize = (key: string) => `humanized-${key}`;

  it("uses humanizeSessionKey when sessionKey is present", () => {
    const entry = makeEntry({ sessionKey: "alex:session:main" });
    expect(formatTranscriptDisplayName(entry, mockHumanize)).toBe("humanized-alex:session:main");
  });

  it("falls back to date/time when no sessionKey but has startedAt", () => {
    const entry = makeEntry({ startedAt: "2026-01-15T14:30:00Z" });
    const result = formatTranscriptDisplayName(entry, mockHumanize);
    // Should contain month and time parts
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });

  it("falls back to truncated sessionId when no sessionKey and no startedAt", () => {
    const entry = makeEntry({ sessionId: "ABCDEFGHIJKLMNOP" });
    expect(formatTranscriptDisplayName(entry, mockHumanize)).toBe("ABCDEFGHIJKL");
  });
});

/* ─── splitByQuery ─── */
describe("splitByQuery", () => {
  it("returns single non-match segment for empty query", () => {
    expect(splitByQuery("hello world", "")).toEqual([{ text: "hello world", match: false }]);
  });

  it("returns single non-match segment for whitespace query", () => {
    expect(splitByQuery("hello world", "   ")).toEqual([{ text: "hello world", match: false }]);
  });

  it("splits text on exact match", () => {
    const result = splitByQuery("hello world hello", "hello");
    expect(result).toEqual([
      { text: "hello", match: true },
      { text: " world ", match: false },
      { text: "hello", match: true },
    ]);
  });

  it("matches case-insensitively", () => {
    const result = splitByQuery("Hello HELLO hello", "hello");
    expect(result).toEqual([
      { text: "Hello", match: true },
      { text: " ", match: false },
      { text: "HELLO", match: true },
      { text: " ", match: false },
      { text: "hello", match: true },
    ]);
  });

  it("returns non-match when query not found", () => {
    expect(splitByQuery("hello world", "xyz")).toEqual([{ text: "hello world", match: false }]);
  });

  it("escapes regex special characters in query", () => {
    const result = splitByQuery("price is $100.00 total", "$100.00");
    expect(result).toEqual([
      { text: "price is ", match: false },
      { text: "$100.00", match: true },
      { text: " total", match: false },
    ]);
  });

  it("handles query at start of text", () => {
    const result = splitByQuery("foo bar", "foo");
    expect(result).toEqual([
      { text: "foo", match: true },
      { text: " bar", match: false },
    ]);
  });

  it("handles query at end of text", () => {
    const result = splitByQuery("bar foo", "foo");
    expect(result).toEqual([
      { text: "bar ", match: false },
      { text: "foo", match: true },
    ]);
  });
});

/* ─── Constants ─── */
describe("transcript constants", () => {
  it("TRANSCRIPT_TYPE_LABELS covers all types", () => {
    const types: Array<"main" | "cron" | "subagent" | "channel" | "unknown"> = [
      "main", "cron", "subagent", "channel", "unknown",
    ];
    for (const t of types) {
      expect(TRANSCRIPT_TYPE_LABELS[t]).toBeDefined();
      expect(typeof TRANSCRIPT_TYPE_LABELS[t]).toBe("string");
    }
  });

  it("TRANSCRIPT_TYPE_COLORS covers all types", () => {
    const types: Array<"main" | "cron" | "subagent" | "channel" | "unknown"> = [
      "main", "cron", "subagent", "channel", "unknown",
    ];
    for (const t of types) {
      expect(TRANSCRIPT_TYPE_COLORS[t]).toBeDefined();
      expect(typeof TRANSCRIPT_TYPE_COLORS[t]).toBe("string");
    }
  });
});
