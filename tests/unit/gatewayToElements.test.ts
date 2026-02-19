import { describe, it, expect } from "vitest";
import { gatewayToElements } from "@/lib/chat/gatewayToElements";
import type { MessagePart } from "@/lib/chat/types";

describe("gatewayToElements", () => {
  it("converts an empty array", () => {
    expect(gatewayToElements([])).toEqual([]);
  });

  it("converts a text part", () => {
    const parts: MessagePart[] = [{ type: "text", text: "Hello", streaming: false }];
    const result = gatewayToElements(parts);
    expect(result).toEqual([
      { type: "text", text: "Hello", streaming: false },
    ]);
  });

  it("converts a streaming text part", () => {
    const parts: MessagePart[] = [{ type: "text", text: "Hel", streaming: true }];
    const result = gatewayToElements(parts);
    expect(result[0]).toMatchObject({ type: "text", streaming: true });
  });

  it("converts a reasoning part without timestamps", () => {
    const parts: MessagePart[] = [
      { type: "reasoning", text: "Let me think...", streaming: true },
    ];
    const result = gatewayToElements(parts);
    expect(result).toEqual([
      { type: "reasoning", text: "Let me think...", streaming: true, durationSeconds: null },
    ]);
  });

  it("converts a reasoning part with timestamps", () => {
    const parts: MessagePart[] = [
      {
        type: "reasoning",
        text: "Analyzed the problem",
        startedAt: 1000,
        completedAt: 3500,
        streaming: false,
      },
    ];
    const result = gatewayToElements(parts);
    expect(result[0]).toMatchObject({
      type: "reasoning",
      durationSeconds: 2.5,
      streaming: false,
    });
  });

  it("converts a pending tool invocation", () => {
    const parts: MessagePart[] = [
      {
        type: "tool-invocation",
        toolCallId: "call_1",
        name: "web_search",
        phase: "pending",
        args: '{"query":"test"}',
      },
    ];
    const result = gatewayToElements(parts);
    expect(result[0]).toMatchObject({
      type: "tool",
      toolCallId: "call_1",
      name: "web_search",
      state: "call",
      args: '{"query":"test"}',
      result: "",
      isError: false,
    });
  });

  it("converts a running tool invocation", () => {
    const parts: MessagePart[] = [
      {
        type: "tool-invocation",
        toolCallId: "call_2",
        name: "exec",
        phase: "running",
      },
    ];
    const result = gatewayToElements(parts);
    expect(result[0]).toMatchObject({ state: "partial-call", isError: false });
  });

  it("converts a complete tool invocation with duration", () => {
    const parts: MessagePart[] = [
      {
        type: "tool-invocation",
        toolCallId: "call_3",
        name: "read",
        phase: "complete",
        result: "file contents",
        startedAt: 5000,
        completedAt: 7300,
      },
    ];
    const result = gatewayToElements(parts);
    expect(result[0]).toMatchObject({
      state: "result",
      result: "file contents",
      isError: false,
      durationSeconds: 2.3,
    });
  });

  it("converts an error tool invocation", () => {
    const parts: MessagePart[] = [
      {
        type: "tool-invocation",
        toolCallId: "call_4",
        name: "exec",
        phase: "error",
        result: "Permission denied",
      },
    ];
    const result = gatewayToElements(parts);
    expect(result[0]).toMatchObject({ state: "result", isError: true });
  });

  it("converts a status part", () => {
    const parts: MessagePart[] = [
      { type: "status", state: "thinking", model: "claude-opus-4", runStartedAt: 1000 },
    ];
    const result = gatewayToElements(parts);
    expect(result).toEqual([
      { type: "status", state: "thinking", model: "claude-opus-4", runStartedAt: 1000 },
    ]);
  });

  it("converts a status part with missing optional fields", () => {
    const parts: MessagePart[] = [{ type: "status", state: "idle" }];
    const result = gatewayToElements(parts);
    expect(result[0]).toMatchObject({ model: null, runStartedAt: null });
  });

  it("converts a mixed array preserving order", () => {
    const parts: MessagePart[] = [
      { type: "reasoning", text: "Thinking...", streaming: true },
      { type: "text", text: "Here is the answer" },
      {
        type: "tool-invocation",
        toolCallId: "c1",
        name: "read",
        phase: "complete",
        result: "data",
      },
      { type: "text", text: "Based on that..." },
    ];
    const result = gatewayToElements(parts);
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.type)).toEqual(["reasoning", "text", "tool", "text"]);
  });

  it("handles tool invocation with no args or result", () => {
    const parts: MessagePart[] = [
      {
        type: "tool-invocation",
        toolCallId: "c5",
        name: "ping",
        phase: "pending",
      },
    ];
    const result = gatewayToElements(parts);
    expect(result[0]).toMatchObject({ args: "", result: "" });
  });
});
