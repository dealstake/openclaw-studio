import { describe, it, expect } from "vitest";
import {
  extractText,
  extractRawText,
  extractRawTextCached,
  extractThinking,
  extractThinkingFromTaggedText,
  extractThinkingFromTaggedStream,
  extractToolCalls,
  extractToolResult,
  extractToolLines,
  formatToolCallMarkdown,
  formatToolResultMarkdown,
  isToolMarkdown,
  parseToolMarkdown,
  stripUiMetadata,
  isHeartbeatPrompt,
  isUiMetadataPrefix,
} from "@/lib/text/message-extract";

/* ---------- extractText ---------- */
describe("extractText", () => {
  it("returns null for non-objects", () => {
    expect(extractText(null)).toBeNull();
    expect(extractText(undefined)).toBeNull();
    expect(extractText("string")).toBeNull();
  });

  it("extracts from string content", () => {
    expect(extractText({ role: "user", content: "hello" })).toBe("hello");
  });

  it("extracts from array content", () => {
    const msg = {
      role: "user",
      content: [
        { type: "text", text: "part one" },
        { type: "text", text: "part two" },
      ],
    };
    expect(extractText(msg)).toBe("part one\npart two");
  });

  it("falls back to text field", () => {
    expect(extractText({ role: "user", text: "fallback" })).toBe("fallback");
  });

  it("strips thinking tags from assistant messages", () => {
    const msg = {
      role: "assistant",
      content: "<thinking>internal</thinking>visible text",
    };
    expect(extractText(msg)).toBe("visible text");
  });

  it("strips envelope from user messages", () => {
    const msg = {
      role: "user",
      content: "[WebChat 2026-01-01] actual message",
    };
    expect(extractText(msg)).toBe("actual message");
  });

  it("does not strip non-envelope brackets", () => {
    const msg = { role: "user", content: "[not an envelope] text" };
    expect(extractText(msg)).toBe("[not an envelope] text");
  });
});

/* ---------- extractThinking ---------- */
describe("extractThinking", () => {
  it("returns null for non-objects", () => {
    expect(extractThinking(null)).toBeNull();
    expect(extractThinking(42)).toBeNull();
  });

  it("extracts from direct thinking key", () => {
    expect(extractThinking({ thinking: "deep thought" })).toBe("deep thought");
  });

  it("extracts from content array with thinking type", () => {
    const msg = {
      content: [{ type: "thinking", text: "inner thought" }],
    };
    expect(extractThinking(msg)).toBe("inner thought");
  });

  it("extracts from tagged text in content", () => {
    const msg = {
      content: "<thinking>tagged thinking</thinking>rest",
    };
    expect(extractThinking(msg)).toBe("tagged thinking");
  });

  it("extracts from open-ended stream tag", () => {
    const msg = {
      content: "<thinking>still thinking...",
    };
    expect(extractThinking(msg)).toBe("still thinking...");
  });

  it("returns null when no thinking found", () => {
    expect(extractThinking({ content: "just text" })).toBeNull();
  });
});

/* ---------- extractThinkingFromTaggedText ---------- */
describe("extractThinkingFromTaggedText", () => {
  it("extracts matched pairs", () => {
    expect(
      extractThinkingFromTaggedText("<thinking>hello</thinking>"),
    ).toBe("hello");
  });

  it("returns empty for no tags", () => {
    expect(extractThinkingFromTaggedText("no tags here")).toBe("");
  });

  it("handles empty input", () => {
    expect(extractThinkingFromTaggedText("")).toBe("");
  });
});

/* ---------- extractThinkingFromTaggedStream ---------- */
describe("extractThinkingFromTaggedStream", () => {
  it("extracts from open-ended tag", () => {
    expect(
      extractThinkingFromTaggedStream("<thinking>in progress"),
    ).toBe("in progress");
  });

  it("returns empty for no tags", () => {
    expect(extractThinkingFromTaggedStream("plain text")).toBe("");
  });

  it("returns closed content when tag is closed", () => {
    expect(
      extractThinkingFromTaggedStream("<thinking>done</thinking>"),
    ).toBe("done");
  });
});

/* ---------- extractToolCalls ---------- */
describe("extractToolCalls", () => {
  it("returns empty for non-objects", () => {
    expect(extractToolCalls(null)).toEqual([]);
    expect(extractToolCalls("string")).toEqual([]);
  });

  it("extracts valid tool calls", () => {
    const msg = {
      content: [
        { type: "toolCall", id: "tc1", name: "read", arguments: { path: "/file" } },
        { type: "text", text: "not a tool call" },
      ],
    };
    const calls = extractToolCalls(msg);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("read");
    expect(calls[0].arguments).toEqual({ path: "/file" });
  });

  it("handles missing fields", () => {
    const msg = { content: [{ type: "toolCall" }] };
    const calls = extractToolCalls(msg);
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBeUndefined();
    expect(calls[0].name).toBeUndefined();
  });
});

/* ---------- extractToolResult ---------- */
describe("extractToolResult", () => {
  it("returns null for non-tool roles", () => {
    expect(extractToolResult({ role: "user" })).toBeNull();
    expect(extractToolResult({ role: "assistant" })).toBeNull();
  });

  it("extracts tool result", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "tc1",
      toolName: "read",
      content: "file contents",
    };
    const result = extractToolResult(msg);
    expect(result).not.toBeNull();
    expect(result!.toolCallId).toBe("tc1");
    expect(result!.toolName).toBe("read");
  });

  it("accepts role tool", () => {
    const result = extractToolResult({ role: "tool", toolName: "exec" });
    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("exec");
  });
});

/* ---------- formatToolCallMarkdown ---------- */
describe("formatToolCallMarkdown", () => {
  it("formats call without args", () => {
    const result = formatToolCallMarkdown({ name: "read" });
    expect(result).toContain("read");
    expect(result).not.toContain("```");
  });

  it("formats call with args", () => {
    const result = formatToolCallMarkdown({
      name: "read",
      id: "tc1",
      arguments: { path: "/file" },
    });
    expect(result).toContain("read");
    expect(result).toContain("tc1");
    expect(result).toContain("```json");
  });
});

/* ---------- formatToolResultMarkdown ---------- */
describe("formatToolResultMarkdown", () => {
  it("formats result without body", () => {
    const result = formatToolResultMarkdown({ toolName: "read" });
    expect(result).toContain("read");
  });

  it("formats result with text", () => {
    const result = formatToolResultMarkdown({
      toolName: "read",
      text: "file contents",
    });
    expect(result).toContain("file contents");
  });
});

/* ---------- stripUiMetadata ---------- */
describe("stripUiMetadata", () => {
  it("strips project path block", () => {
    const input = "Project path: /some/path\n\nActual message";
    expect(stripUiMetadata(input)).toBe("Actual message");
  });

  it("strips message IDs", () => {
    const input = "hello [message_id:abc-123] world";
    expect(stripUiMetadata(input)).toBe("helloworld");
  });

  it("returns empty strings unchanged", () => {
    expect(stripUiMetadata("")).toBe("");
  });

  it("preserves normal text", () => {
    expect(stripUiMetadata("just a normal message")).toBe("just a normal message");
  });
});

/* ---------- isHeartbeatPrompt ---------- */
describe("isHeartbeatPrompt", () => {
  it("detects heartbeat prompts", () => {
    expect(isHeartbeatPrompt("Read HEARTBEAT.md if it exists and check...")).toBe(true);
  });

  it("detects heartbeat path variant", () => {
    expect(isHeartbeatPrompt("Heartbeat file path: /some/path")).toBe(true);
  });

  it("rejects non-heartbeat text", () => {
    expect(isHeartbeatPrompt("Hello world")).toBe(false);
  });

  it("handles empty/falsy input", () => {
    expect(isHeartbeatPrompt("")).toBe(false);
    expect(isHeartbeatPrompt("   ")).toBe(false);
  });
});

/* ---------- extractRawText ---------- */
describe("extractRawText", () => {
  it("returns string content without stripping thinking tags", () => {
    const msg = { role: "assistant", content: "<thinking>inner</thinking>visible" };
    expect(extractRawText(msg)).toBe("<thinking>inner</thinking>visible");
  });

  it("returns string content without stripping envelope", () => {
    const msg = { role: "user", content: "[WebChat 2026-01-01] actual message" };
    expect(extractRawText(msg)).toBe("[WebChat 2026-01-01] actual message");
  });

  it("returns null for non-objects", () => {
    expect(extractRawText(null)).toBeNull();
    expect(extractRawText(42)).toBeNull();
  });
});

/* ---------- extractRawTextCached ---------- */
describe("extractRawTextCached", () => {
  it("returns same result as extractRawText", () => {
    const msg = { content: "hello" };
    expect(extractRawTextCached(msg)).toBe("hello");
  });

  it("returns cached result on second call", () => {
    const msg = { content: "cached" };
    const first = extractRawTextCached(msg);
    const second = extractRawTextCached(msg);
    expect(first).toBe(second);
    expect(first).toBe("cached");
  });

  it("handles non-object input", () => {
    expect(extractRawTextCached(null)).toBeNull();
    expect(extractRawTextCached("string")).toBeNull();
  });
});

/* ---------- extractToolLines ---------- */
describe("extractToolLines", () => {
  it("combines tool calls and results", () => {
    const msg = {
      content: [{ type: "toolCall", name: "exec", arguments: { cmd: "ls" } }],
    };
    const lines = extractToolLines(msg);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("exec");
  });

  it("returns empty for non-tool messages", () => {
    expect(extractToolLines({ content: "plain" })).toEqual([]);
  });
});

/* ---------- isToolMarkdown ---------- */
describe("isToolMarkdown", () => {
  it("detects tool call markdown", () => {
    expect(isToolMarkdown("[[tool]] read")).toBe(true);
  });

  it("detects tool result markdown", () => {
    expect(isToolMarkdown("[[tool-result]] read")).toBe(true);
  });

  it("rejects non-tool lines", () => {
    expect(isToolMarkdown("just text")).toBe(false);
  });
});

/* ---------- parseToolMarkdown ---------- */
describe("parseToolMarkdown", () => {
  it("parses tool call line", () => {
    const parsed = parseToolMarkdown("[[tool]] read (tc1)");
    expect(parsed.kind).toBe("call");
    expect(parsed.label).toBe("read (tc1)");
    expect(parsed.body).toBe("");
  });

  it("parses tool result with body", () => {
    const parsed = parseToolMarkdown("[[tool-result]] exec\n```text\noutput\n```");
    expect(parsed.kind).toBe("result");
    expect(parsed.label).toBe("exec");
    expect(parsed.body).toContain("output");
  });
});

/* ---------- isUiMetadataPrefix ---------- */
describe("isUiMetadataPrefix", () => {
  it("detects project path prefix", () => {
    expect(isUiMetadataPrefix("Project path: /some/path")).toBe(true);
  });

  it("detects workspace path prefix", () => {
    expect(isUiMetadataPrefix("Workspace path: /some/path")).toBe(true);
  });

  it("detects reset session prefix", () => {
    expect(isUiMetadataPrefix("A new session was started via /new or /reset")).toBe(true);
  });

  it("rejects normal text", () => {
    expect(isUiMetadataPrefix("Hello world")).toBe(false);
  });
});
