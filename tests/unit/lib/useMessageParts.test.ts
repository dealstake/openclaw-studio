import { describe, it, expect } from "vitest";
import { parseMessageParts, type ParseMessagePartsInput } from "@/lib/chat/parseMessageParts";

const make = (overrides: Partial<ParseMessagePartsInput> = {}): ParseMessagePartsInput => ({
  outputLines: [],
  streamText: null,
  liveThinkingTrace: "",
  ...overrides,
});

describe("parseMessageParts", () => {
  it("returns empty array for empty input", () => {
    expect(parseMessageParts(make())).toEqual([]);
  });

  it("skips empty lines", () => {
    expect(parseMessageParts(make({ outputLines: ["", ""] }))).toEqual([]);
  });

  // ── Reasoning / trace lines ──────────────────────────────────────────

  describe("reasoning lines", () => {
    it("parses a [[trace]] line into a reasoning part", () => {
      const parts = parseMessageParts(make({ outputLines: ["[[trace]] Thinking about this..."] }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({ type: "reasoning", text: "Thinking about this..." });
    });

    it("merges consecutive reasoning parts", () => {
      const parts = parseMessageParts(make({
        outputLines: ["[[trace]] First thought", "[[trace]] Second thought"],
      }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({
        type: "reasoning",
        text: "First thought\n\nSecond thought",
      });
    });

    it("handles trace with only whitespace after prefix", () => {
      const parts = parseMessageParts(make({ outputLines: ["[[trace]]   "] }));
      expect(parts).toEqual([]);
    });
  });

  // ── Tool call / result lines ─────────────────────────────────────────

  describe("tool lines", () => {
    it("parses a tool call line", () => {
      const parts = parseMessageParts(make({
        outputLines: ["[[tool]] web_search (call_abc)\n```json\n{\"query\":\"hello\"}\n```"],
      }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({
        type: "tool-invocation",
        name: "web_search",
        toolCallId: "call_abc",
        // Unmatched tool calls from history are marked complete (already finished)
        phase: "complete",
        args: expect.stringContaining("hello"),
      });
    });

    it("parses a tool result line", () => {
      const parts = parseMessageParts(make({
        outputLines: ["[[tool-result]] exec (call_xyz)\nDone successfully"],
      }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({
        type: "tool-invocation",
        name: "exec",
        toolCallId: "call_xyz",
        phase: "complete",
        result: "Done successfully",
      });
    });

    it("handles tool call without parenthetical id", () => {
      const parts = parseMessageParts(make({
        outputLines: ["[[tool]] read_file"],
      }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({
        type: "tool-invocation",
        name: "read_file",
        toolCallId: "",
        // No toolCallId = can't match a result, so marked complete from history
        phase: "complete",
      });
    });

    it("merges tool result into matching tool call by toolCallId", () => {
      const parts = parseMessageParts(make({
        outputLines: [
          "[[tool]] exec (call_123)\n```json\n{\"cmd\":\"ls\"}\n```",
          "[[tool-result]] exec (call_123)\nfile1.txt\nfile2.txt",
        ],
      }));
      // Should merge into a single part, not two
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({
        type: "tool-invocation",
        name: "exec",
        toolCallId: "call_123",
        phase: "complete",
        args: expect.stringContaining("ls"),
        result: expect.stringContaining("file1.txt"),
      });
    });
  });

  // ── User-quoted lines ────────────────────────────────────────────────

  describe("user-quoted lines", () => {
    it("parses a > quoted line as text", () => {
      const parts = parseMessageParts(make({ outputLines: ["> Hello from user"] }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({ type: "text", text: "Hello from user" });
    });

    it("strips inbound metadata from quoted lines", () => {
      const metaLine = `> Conversation info (untrusted metadata):\n\`\`\`json\n{"channel":"whatsapp"}\n\`\`\`\nActual message`;
      const parts = parseMessageParts(make({ outputLines: [metaLine] }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({ type: "text", text: "Actual message" });
    });

    it("strips timestamp prefix from quoted lines", () => {
      const line = "> [Mon 2026-02-20 3:45 EST] Hey there";
      const parts = parseMessageParts(make({ outputLines: [line] }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({ type: "text", text: "Hey there" });
    });
  });

  // ── Assistant text ───────────────────────────────────────────────────

  describe("assistant text", () => {
    it("parses plain text as a text part", () => {
      const parts = parseMessageParts(make({ outputLines: ["Hello, world!"] }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({ type: "text", text: "Hello, world!" });
    });

    it("normalizes redundant blank lines", () => {
      const parts = parseMessageParts(make({ outputLines: ["Line 1\n\n\n\nLine 2"] }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({ type: "text", text: "Line 1\n\nLine 2" });
    });

    it("trims trailing whitespace from lines", () => {
      const parts = parseMessageParts(make({ outputLines: ["Hello   \n  World  "] }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({ type: "text", text: "Hello\n  World" });
    });
  });

  // ── Live streams ─────────────────────────────────────────────────────

  describe("live thinking trace", () => {
    it("appends live thinking as streaming reasoning", () => {
      const parts = parseMessageParts(make({ liveThinkingTrace: "Still thinking..." }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({ type: "reasoning", text: "Still thinking...", streaming: true });
    });

    it("merges live thinking with existing reasoning", () => {
      const parts = parseMessageParts(make({
        outputLines: ["[[trace]] Initial thought"],
        liveThinkingTrace: "Continued thinking",
      }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({ type: "reasoning", streaming: true });
    });

    it("ignores empty live thinking", () => {
      const parts = parseMessageParts(make({ liveThinkingTrace: "   " }));
      expect(parts).toEqual([]);
    });
  });

  describe("live stream text", () => {
    it("appends live stream as streaming text", () => {
      const parts = parseMessageParts(make({ streamText: "Streaming response..." }));
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({ type: "text", text: "Streaming response...", streaming: true });
    });

    it("ignores empty stream text", () => {
      const parts = parseMessageParts(make({ streamText: "   " }));
      expect(parts).toEqual([]);
    });
  });

  // ── Mixed scenarios ──────────────────────────────────────────────────

  describe("mixed output", () => {
    it("produces correct order: reasoning → tool → text → stream", () => {
      const parts = parseMessageParts(make({
        outputLines: [
          "[[trace]] Let me think",
          "[[tool]] web_search (c1)\n```json\n{}\n```",
          "[[tool-result]] web_search (c1)\nResults here",
          "Here is what I found",
        ],
        streamText: "and more...",
        liveThinkingTrace: "",
      }));
      // Tool call + result merge into one part (matched by toolCallId "c1")
      expect(parts.map((p) => p.type)).toEqual([
        "reasoning",
        "tool-invocation",
        "text",
        "text",
      ]);
      // Merged tool part should be complete with result
      expect(parts[1]).toMatchObject({
        type: "tool-invocation",
        phase: "complete",
        result: expect.stringContaining("Results here"),
      });
      // Verify stream text is marked streaming
      expect(parts[3]).toMatchObject({ streaming: true });
    });
  });
});
