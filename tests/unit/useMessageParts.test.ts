import { describe, it, expect } from "vitest";
import { parseMessageParts } from "@/lib/chat/parseMessageParts";

describe("parseMessageParts", () => {
  it("returns empty array for empty input", () => {
    const result = parseMessageParts({
      outputLines: [],
      streamText: null,
      liveThinkingTrace: "",
    });
    expect(result).toEqual([]);
  });

  it("parses plain assistant text lines", () => {
    const result = parseMessageParts({
      outputLines: ["Hello, how can I help?"],
      streamText: null,
      liveThinkingTrace: "",
    });
    expect(result).toEqual([
      { type: "text", text: "Hello, how can I help?" },
    ]);
  });

  it("normalizes assistant text (collapses blank lines)", () => {
    const result = parseMessageParts({
      outputLines: ["Line one\n\n\n\nLine two"],
      streamText: null,
      liveThinkingTrace: "",
    });
    expect(result[0]).toMatchObject({
      type: "text",
      text: "Line one\n\nLine two",
    });
  });

  it("parses user-quoted lines (> prefix)", () => {
    const result = parseMessageParts({
      outputLines: ["> What is the weather?"],
      streamText: null,
      liveThinkingTrace: "",
    });
    expect(result).toEqual([{ type: "text", text: "What is the weather?" }]);
  });

  it("strips inbound metadata from user-quoted lines", () => {
    const line =
      '> Conversation info (untrusted metadata):\n```json\n{"channel":"whatsapp"}\n```\n\n[Thu 2026-02-19 11:41 EST] Hello';
    const result = parseMessageParts({
      outputLines: [line],
      streamText: null,
      liveThinkingTrace: "",
    });
    expect(result[0]).toMatchObject({ type: "text", text: "Hello" });
  });

  it("parses thinking/trace lines", () => {
    const result = parseMessageParts({
      outputLines: ["[[trace]]\n_Let me analyze this_"],
      streamText: null,
      liveThinkingTrace: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "reasoning",
      text: expect.stringContaining("Let me analyze"),
    });
  });

  it("merges consecutive reasoning parts", () => {
    const result = parseMessageParts({
      outputLines: [
        "[[trace]]\n_First thought_",
        "[[trace]]\n_Second thought_",
      ],
      streamText: null,
      liveThinkingTrace: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "reasoning",
      text: expect.stringContaining("Second thought"),
    });
  });

  it("parses tool call lines", () => {
    const result = parseMessageParts({
      outputLines: ['[[tool]] web_search (call_1)\n```json\n{"query":"test"}\n```'],
      streamText: null,
      liveThinkingTrace: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "tool-invocation",
      name: "web_search",
      toolCallId: "call_1",
      // Unmatched tool calls from history are marked complete
      phase: "complete",
    });
  });

  it("parses tool result lines", () => {
    const result = parseMessageParts({
      outputLines: ["[[tool-result]] exec (call_2)\nexit 0\n```text\noutput\n```"],
      streamText: null,
      liveThinkingTrace: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "tool-invocation",
      name: "exec",
      toolCallId: "call_2",
      phase: "complete",
    });
  });

  it("appends live thinking trace as streaming reasoning", () => {
    const result = parseMessageParts({
      outputLines: [],
      streamText: null,
      liveThinkingTrace: "I need to consider...",
    });
    expect(result).toEqual([
      { type: "reasoning", text: "I need to consider...", streaming: true },
    ]);
  });

  it("appends live stream text as streaming text", () => {
    const result = parseMessageParts({
      outputLines: [],
      streamText: "Here is what I found so far",
      liveThinkingTrace: "",
    });
    expect(result).toEqual([
      { type: "text", text: "Here is what I found so far", streaming: true },
    ]);
  });

  it("handles mixed content preserving order", () => {
    const result = parseMessageParts({
      outputLines: [
        "> User question",
        "[[trace]]\n_Thinking_",
        '[[tool]] read (c1)\n```json\n{"path":"foo"}\n```',
        "[[tool-result]] read (c1)\nfile contents",
        "Here is the answer.",
      ],
      streamText: null,
      liveThinkingTrace: "",
    });
    const types = result.map((p) => p.type);
    // Tool call + result merge into one part (matched by toolCallId "c1")
    expect(types).toEqual([
      "text",
      "reasoning",
      "tool-invocation",
      "text",
    ]);
  });

  it("skips empty output lines", () => {
    const result = parseMessageParts({
      outputLines: ["", "", "Hello", ""],
      streamText: null,
      liveThinkingTrace: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "text", text: "Hello" });
  });

  it("merges live thinking with existing trace reasoning", () => {
    const result = parseMessageParts({
      outputLines: ["[[trace]]\n_First thought_"],
      streamText: null,
      liveThinkingTrace: "Continuing to think...",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "reasoning",
      streaming: true,
    });
  });

  it("handles both live thinking and live stream simultaneously", () => {
    const result = parseMessageParts({
      outputLines: [],
      streamText: "Partial response",
      liveThinkingTrace: "Still thinking",
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: "reasoning", streaming: true });
    expect(result[1]).toMatchObject({ type: "text", streaming: true });
  });

  it("ignores whitespace-only stream text", () => {
    const result = parseMessageParts({
      outputLines: [],
      streamText: "   \n  ",
      liveThinkingTrace: "",
    });
    expect(result).toEqual([]);
  });

  it("ignores whitespace-only thinking trace", () => {
    const result = parseMessageParts({
      outputLines: [],
      streamText: null,
      liveThinkingTrace: "   ",
    });
    expect(result).toEqual([]);
  });

  it("detects content changes when line count stays the same", () => {
    // Simulate in-place replacement: same array length, different content
    const resultA = parseMessageParts({
      outputLines: ["Hello world"],
      streamText: null,
      liveThinkingTrace: "",
    });
    const resultB = parseMessageParts({
      outputLines: ["Goodbye world"],
      streamText: null,
      liveThinkingTrace: "",
    });
    // Both have 1 line but different content — should produce different parts
    expect(resultA[0]).toEqual({ type: "text", text: "Hello world" });
    expect(resultB[0]).toEqual({ type: "text", text: "Goodbye world" });
    expect(resultA).not.toEqual(resultB);
  });
});
