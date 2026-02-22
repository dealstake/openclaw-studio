import { describe, it, expect } from "vitest";
import { transformMessagesToMessageParts } from "@/features/sessions/lib/transformMessages";

describe("transformMessagesToMessageParts", () => {
  it("returns empty array for empty input", () => {
    expect(transformMessagesToMessageParts([])).toEqual([]);
  });

  it("transforms plain text user message with metadata stripping", () => {
    const parts = transformMessagesToMessageParts([
      { role: "user", content: 'Conversation info (untrusted metadata):\n```json\n{"foo":"bar"}\n```\nHello there' },
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: "text", text: "> Hello there" });
  });

  it("transforms plain text user message without metadata", () => {
    const parts = transformMessagesToMessageParts([
      { role: "user", content: "What is 2+2?" },
    ]);
    expect(parts).toEqual([{ type: "text", text: "> What is 2+2?" }]);
  });

  it("transforms plain text assistant message", () => {
    const parts = transformMessagesToMessageParts([
      { role: "assistant", content: "The answer is 4." },
    ]);
    expect(parts).toEqual([{ type: "text", text: "The answer is 4." }]);
  });

  it("skips empty assistant content", () => {
    const parts = transformMessagesToMessageParts([
      { role: "assistant", content: "" },
    ]);
    expect(parts).toEqual([]);
  });

  it("handles structured content with thinking blocks", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me think about this..." },
          { type: "text", text: "Here is my answer." },
        ],
      },
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ type: "reasoning", text: "Let me think about this..." });
    expect(parts[1]).toEqual({ type: "text", text: "Here is my answer." });
  });

  it("handles thinking block with text field fallback", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "assistant",
        content: [{ type: "thinking", text: "Fallback thinking" }],
      },
    ]);
    expect(parts).toEqual([{ type: "reasoning", text: "Fallback thinking" }]);
  });

  it("handles tool_use and matching tool_result", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tool-1", name: "search", input: { query: "test" } },
        ],
      },
      {
        role: "tool",
        tool_use_id: "tool-1",
        content: "Search results here",
      } as Record<string, unknown>,
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: "tool-invocation",
      toolCallId: "tool-1",
      name: "search",
      phase: "complete",
      result: "Search results here",
    });
  });

  it("handles orphan tool result as text", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "tool",
        tool_use_id: "orphan-id",
        content: "Orphan result",
      } as Record<string, unknown>,
    ]);
    expect(parts).toEqual([{ type: "text", text: "Orphan result" }]);
  });

  it("handles user message with structured content array", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "user",
        content: [{ type: "text", text: "Hello from array" }],
      },
    ]);
    expect(parts).toEqual([{ type: "text", text: "> Hello from array" }]);
  });

  it("uses msg.text as fallback for assistant", () => {
    const parts = transformMessagesToMessageParts([
      { role: "assistant", text: "Fallback text" },
    ]);
    expect(parts).toEqual([{ type: "text", text: "Fallback text" }]);
  });

  it("handles multiple messages in sequence", () => {
    const parts = transformMessagesToMessageParts([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "Bye" },
      { role: "assistant", content: "Goodbye!" },
    ]);
    expect(parts).toHaveLength(4);
    expect(parts[0]).toEqual({ type: "text", text: "> Hi" });
    expect(parts[1]).toEqual({ type: "text", text: "Hello!" });
    expect(parts[2]).toEqual({ type: "text", text: "> Bye" });
    expect(parts[3]).toEqual({ type: "text", text: "Goodbye!" });
  });

  it("skips unknown content block types", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "assistant",
        content: [
          { type: "unknown_type", data: "foo" },
          { type: "text", text: "Valid text" },
        ],
      },
    ]);
    expect(parts).toEqual([{ type: "text", text: "Valid text" }]);
  });

  it("strips timestamp prefix from user messages", () => {
    const parts = transformMessagesToMessageParts([
      { role: "user", content: "[Mon 2026-02-21 3:30 EST] Hello" },
    ]);
    expect(parts).toEqual([{ type: "text", text: "> Hello" }]);
  });

  it("tool_use without id gets synthetic toolCallId", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "assistant",
        content: [{ type: "tool_use", name: "exec" }],
      },
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: "tool-invocation",
      name: "exec",
      phase: "complete",
    });
    expect((parts[0] as { toolCallId: string }).toolCallId).toBe("tool-0");
  });
});
