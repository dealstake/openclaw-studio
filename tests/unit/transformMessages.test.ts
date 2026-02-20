import { describe, it, expect } from "vitest";
import { transformMessagesToMessageParts } from "@/features/sessions/lib/transformMessages";

describe("transformMessagesToMessageParts", () => {
  it("transforms plain text messages", () => {
    const parts = transformMessagesToMessageParts([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ type: "text", text: "> Hello" });
    expect(parts[1]).toEqual({ type: "text", text: "Hi there" });
  });

  it("strips inbound metadata from user messages", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "user",
        content: 'Conversation info (untrusted metadata):\n```json\n{"channel":"whatsapp"}\n```\nHello',
      },
    ]);
    expect(parts[0]).toEqual({ type: "text", text: "> Hello" });
  });

  it("strips timestamp prefix from user messages", () => {
    const parts = transformMessagesToMessageParts([
      { role: "user", content: "[Mon 2026-02-20 10:05 EST] Hello" },
    ]);
    expect(parts[0]).toEqual({ type: "text", text: "> Hello" });
  });

  it("parses structured content with thinking blocks", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me think..." },
          { type: "text", text: "Here is my answer" },
        ],
      },
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ type: "reasoning", text: "Let me think..." });
    expect(parts[1]).toEqual({ type: "text", text: "Here is my answer" });
  });

  it("parses tool_use blocks from assistant messages", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tc1", name: "web_search", input: { query: "test" } },
          { type: "text", text: "Found results" },
        ],
      },
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({
      type: "tool-invocation",
      toolCallId: "tc1",
      name: "web_search",
      phase: "complete",
      args: '{"query":"test"}',
    });
    expect(parts[1]).toEqual({ type: "text", text: "Found results" });
  });

  it("matches tool results with tool_use blocks", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tc1", name: "exec", input: { command: "ls" } },
        ],
      },
      {
        role: "tool",
        tool_use_id: "tc1",
        content: "file1.txt\nfile2.txt",
      } as Record<string, unknown>,
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: "tool-invocation",
      toolCallId: "tc1",
      name: "exec",
      phase: "complete",
      result: "file1.txt\nfile2.txt",
    });
  });

  it("handles orphan tool results as text", () => {
    const parts = transformMessagesToMessageParts([
      { role: "tool", content: "some result" } as Record<string, unknown>,
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: "text", text: "some result" });
  });

  it("handles empty messages", () => {
    const parts = transformMessagesToMessageParts([
      { role: "assistant", content: "" },
      { role: "user", content: "" },
    ]);
    expect(parts).toHaveLength(0);
  });

  it("handles msg.text fallback", () => {
    const parts = transformMessagesToMessageParts([
      { role: "assistant", text: "fallback text" },
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: "text", text: "fallback text" });
  });

  it("handles content array with text blocks for user messages", () => {
    const parts = transformMessagesToMessageParts([
      { role: "user", content: [{ type: "text", text: "Hello from array" }] },
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: "text", text: "> Hello from array" });
  });

  it("handles thinking block with text field instead of thinking field", () => {
    const parts = transformMessagesToMessageParts([
      {
        role: "assistant",
        content: [{ type: "thinking", text: "Thinking via text field" }],
      },
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: "reasoning", text: "Thinking via text field" });
  });
});
