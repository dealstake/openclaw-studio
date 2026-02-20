import { describe, it, expect } from "vitest";
import {
  buildHistoryLines,
  mergeHistoryWithPending,
  buildHistorySyncPatch,
} from "@/features/agents/state/historyUtils";
import type { ChatHistoryMessage } from "@/features/agents/state/runtimeEventBridge.types";

// Helper to create a minimal message
const msg = (role: string, content: string, extra?: Record<string, unknown>): ChatHistoryMessage => ({
  role,
  content,
  ...extra,
});

describe("buildHistoryLines", () => {
  it("returns empty result for empty messages", () => {
    const result = buildHistoryLines([]);
    expect(result.lines).toEqual([]);
    expect(result.lastAssistant).toBeNull();
    expect(result.lastAssistantAt).toBeNull();
    expect(result.lastRole).toBeNull();
    expect(result.lastUser).toBeNull();
  });

  it("formats user messages with > prefix", () => {
    const result = buildHistoryLines([msg("user", "hello")]);
    expect(result.lines).toEqual(["> hello"]);
    expect(result.lastUser).toBe("hello");
    expect(result.lastRole).toBe("user");
  });

  it("extracts assistant text and tracks lastAssistant", () => {
    const result = buildHistoryLines([msg("assistant", "response text")]);
    expect(result.lines).toContain("response text");
    expect(result.lastAssistant).toBe("response text");
    expect(result.lastRole).toBe("assistant");
  });

  it("extracts assistant timestamp from message", () => {
    const ts = 1700000000000;
    const result = buildHistoryLines([msg("assistant", "hi", { timestamp: ts })]);
    expect(result.lastAssistantAt).toBe(ts);
  });

  it("skips messages with no text or tool lines", () => {
    const result = buildHistoryLines([msg("user", ""), msg("assistant", "")]);
    expect(result.lines).toEqual([]);
  });

  it("deduplicates consecutive identical lines", () => {
    const result = buildHistoryLines([
      msg("assistant", "same"),
      msg("assistant", "same"),
      msg("assistant", "different"),
    ]);
    // Should deduplicate consecutive "same" lines
    const sameCount = result.lines.filter((l) => l === "same").length;
    expect(sameCount).toBe(1);
    expect(result.lines).toContain("different");
  });

  it("tracks both lastUser and lastAssistant across mixed messages", () => {
    const result = buildHistoryLines([
      msg("user", "question"),
      msg("assistant", "answer"),
    ]);
    expect(result.lastUser).toBe("question");
    expect(result.lastAssistant).toBe("answer");
    expect(result.lastRole).toBe("assistant");
  });
});

describe("mergeHistoryWithPending", () => {
  it("returns historyLines when currentLines is empty", () => {
    const result = mergeHistoryWithPending(["a", "b"], []);
    expect(result).toEqual(["a", "b"]);
  });

  it("returns historyLines when historyLines is empty", () => {
    const result = mergeHistoryWithPending([], ["a", "b"]);
    expect(result).toEqual([]);
  });

  it("merges non-overlapping lines into history", () => {
    const result = mergeHistoryWithPending(["a", "c"], ["b"]);
    // "b" not found in history, so it gets spliced in at cursor 0
    expect(result).toContain("b");
    expect(result.length).toBe(3);
  });

  it("skips lines already present in history", () => {
    const result = mergeHistoryWithPending(["a", "b", "c"], ["a", "c"]);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("inserts new lines at correct position after matched lines", () => {
    const result = mergeHistoryWithPending(["a", "c"], ["a", "b", "c"]);
    expect(result).toEqual(["a", "b", "c"]);
  });
});

describe("buildHistorySyncPatch", () => {
  it("returns only historyLoadedAt for empty messages", () => {
    const patch = buildHistorySyncPatch({
      messages: [],
      loadedAt: 1000,
      status: "idle",
      runId: null,
    });
    expect(patch).toEqual({ historyLoadedAt: 1000 });
  });

  it("builds messageParts and tracks last messages", () => {
    const patch = buildHistorySyncPatch({
      messages: [msg("user", "hi"), msg("assistant", "hello")],
      loadedAt: 2000,
      status: "idle",
      runId: null,
    });
    expect(patch.historyLoadedAt).toBe(2000);
    expect(patch.lastResult).toBe("hello");
    expect(patch.latestPreview).toBe("hello");
    expect(patch.lastUserMessage).toBe("hi");
    expect(patch.messageParts).toBeDefined();
    expect(Array.isArray(patch.messageParts)).toBe(true);
  });

  it("sets status to idle when running with no runId and last role is assistant", () => {
    const patch = buildHistorySyncPatch({
      messages: [msg("assistant", "done")],
      loadedAt: 3000,
      status: "running",
      runId: null,
    });
    expect(patch.status).toBe("idle");
    expect(patch.runId).toBeNull();
    expect(patch.streamText).toBeNull();
    expect(patch.thinkingTrace).toBeNull();
  });

  it("does not override status when runId is present", () => {
    const patch = buildHistorySyncPatch({
      messages: [msg("assistant", "still going")],
      loadedAt: 4000,
      status: "running",
      runId: "run-123",
    });
    expect(patch.status).toBeUndefined();
  });
});
