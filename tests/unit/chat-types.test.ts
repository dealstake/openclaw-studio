import { describe, it, expect } from "vitest";
import {
  type MessagePart,
  isTextPart,
  isReasoningPart,
  isToolInvocationPart,
  isStatusPart,
  filterParts,
} from "@/lib/chat/types";

describe("MessagePart type guards", () => {
  const textPart: MessagePart = { type: "text", text: "hello", streaming: true };
  const reasoningPart: MessagePart = {
    type: "reasoning",
    text: "thinking...",
    startedAt: 1000,
    completedAt: 2000,
    streaming: false,
  };
  const toolPart: MessagePart = {
    type: "tool-invocation",
    toolCallId: "tc-1",
    name: "web_search",
    phase: "running",
    args: '{"query":"test"}',
    startedAt: 1000,
  };
  const statusPart: MessagePart = {
    type: "status",
    state: "thinking",
    model: "claude-opus-4",
    runStartedAt: 1000,
  };

  it("isTextPart identifies text parts", () => {
    expect(isTextPart(textPart)).toBe(true);
    expect(isTextPart(reasoningPart)).toBe(false);
    expect(isTextPart(toolPart)).toBe(false);
    expect(isTextPart(statusPart)).toBe(false);
  });

  it("isReasoningPart identifies reasoning parts", () => {
    expect(isReasoningPart(reasoningPart)).toBe(true);
    expect(isReasoningPart(textPart)).toBe(false);
  });

  it("isToolInvocationPart identifies tool invocation parts", () => {
    expect(isToolInvocationPart(toolPart)).toBe(true);
    expect(isToolInvocationPart(textPart)).toBe(false);
  });

  it("isStatusPart identifies status parts", () => {
    expect(isStatusPart(statusPart)).toBe(true);
    expect(isStatusPart(textPart)).toBe(false);
  });

  it("type guard narrows to correct type", () => {
    if (isTextPart(textPart)) {
      // TypeScript should narrow to TextPart
      expect(textPart.text).toBe("hello");
      expect(textPart.streaming).toBe(true);
    }
    if (isToolInvocationPart(toolPart)) {
      expect(toolPart.toolCallId).toBe("tc-1");
      expect(toolPart.phase).toBe("running");
    }
  });
});

describe("filterParts", () => {
  const parts: MessagePart[] = [
    { type: "text", text: "hello" },
    { type: "reasoning", text: "thinking" },
    { type: "text", text: "world" },
    { type: "tool-invocation", toolCallId: "tc-1", name: "exec", phase: "complete" },
    { type: "status", state: "idle" },
  ];

  it("filters text parts", () => {
    const texts = filterParts(parts, "text");
    expect(texts).toHaveLength(2);
    expect(texts[0].text).toBe("hello");
    expect(texts[1].text).toBe("world");
  });

  it("filters reasoning parts", () => {
    const reasoning = filterParts(parts, "reasoning");
    expect(reasoning).toHaveLength(1);
    expect(reasoning[0].text).toBe("thinking");
  });

  it("filters tool-invocation parts", () => {
    const tools = filterParts(parts, "tool-invocation");
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("exec");
  });

  it("filters status parts", () => {
    const statuses = filterParts(parts, "status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0].state).toBe("idle");
  });

  it("returns empty array when no matches", () => {
    const noTools = filterParts(
      [{ type: "text", text: "only text" }],
      "tool-invocation",
    );
    expect(noTools).toHaveLength(0);
  });
});

describe("MessagePart optional fields", () => {
  it("text part works with minimal fields", () => {
    const part: MessagePart = { type: "text", text: "" };
    expect(isTextPart(part)).toBe(true);
  });

  it("tool-invocation supports all phases", () => {
    const phases = ["pending", "running", "complete", "error"] as const;
    for (const phase of phases) {
      const part: MessagePart = {
        type: "tool-invocation",
        toolCallId: `tc-${phase}`,
        name: "test",
        phase,
      };
      expect(isToolInvocationPart(part)).toBe(true);
    }
  });

  it("reasoning part works without timestamps", () => {
    const part: MessagePart = { type: "reasoning", text: "hmm" };
    expect(isReasoningPart(part)).toBe(true);
  });

  it("status part works without optional model/runStartedAt", () => {
    const part: MessagePart = { type: "status", state: "idle" };
    expect(isStatusPart(part)).toBe(true);
  });
});
