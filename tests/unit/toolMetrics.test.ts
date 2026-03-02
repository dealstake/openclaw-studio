import { describe, it, expect } from "vitest";
import {
  extractToolInvocations,
  aggregateToolMetrics,
} from "@/features/usage/lib/toolMetrics";

describe("extractToolInvocations", () => {
  it("returns empty array for invalid JSON", () => {
    expect(extractToolInvocations("not json")).toEqual([]);
  });

  it("returns empty array for empty transcript", () => {
    expect(extractToolInvocations("[]")).toEqual([]);
  });

  it("extracts tool_use blocks from assistant messages", () => {
    const transcript = JSON.stringify([
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me search..." },
          { type: "tool_use", id: "tu_1", name: "web_search", input: { query: "test" } },
        ],
      },
      {
        role: "tool",
        tool_use_id: "tu_1",
        content: "Search results here",
      },
    ]);

    const invocations = extractToolInvocations(transcript);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]!.toolName).toBe("web_search");
    expect(invocations[0]!.isError).toBe(false);
  });

  it("detects error tool results", () => {
    const transcript = JSON.stringify([
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tu_2", name: "exec", input: {} },
        ],
      },
      {
        role: "tool",
        tool_use_id: "tu_2",
        is_error: true,
        content: "Command failed",
      },
    ]);

    const invocations = extractToolInvocations(transcript);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]!.isError).toBe(true);
    expect(invocations[0]!.errorMessage).toBe("Command failed");
  });

  it("handles multiple tool calls in one message", () => {
    const transcript = JSON.stringify([
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tu_3", name: "read", input: {} },
          { type: "tool_use", id: "tu_4", name: "write", input: {} },
        ],
      },
      { role: "tool", tool_use_id: "tu_3", content: "file content" },
      { role: "tool", tool_use_id: "tu_4", content: "ok" },
    ]);

    const invocations = extractToolInvocations(transcript);
    expect(invocations).toHaveLength(2);
    expect(invocations[0]!.toolName).toBe("read");
    expect(invocations[1]!.toolName).toBe("write");
  });

  it("estimates latency from timestamps", () => {
    const transcript = JSON.stringify([
      {
        role: "assistant",
        timestamp: "2026-03-01T10:00:00Z",
        content: [
          { type: "tool_use", id: "tu_5", name: "exec", input: {} },
        ],
      },
      {
        role: "tool",
        tool_use_id: "tu_5",
        timestamp: "2026-03-01T10:00:05Z",
        content: "done",
      },
    ]);

    const invocations = extractToolInvocations(transcript);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]!.latencyMs).toBe(5000);
  });

  it("handles nested messages format", () => {
    const transcript = JSON.stringify({
      messages: [
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "tu_6", name: "browser", input: {} }],
        },
        { role: "tool", tool_use_id: "tu_6", content: "ok" },
      ],
    });

    const invocations = extractToolInvocations(transcript);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]!.toolName).toBe("browser");
  });
});

describe("aggregateToolMetrics", () => {
  it("returns empty array for no invocations", () => {
    expect(aggregateToolMetrics([])).toEqual([]);
  });

  it("aggregates by tool name", () => {
    const invocations = [
      { toolName: "read", isError: false, latencyMs: 100, errorMessage: null, timestamp: null },
      { toolName: "read", isError: false, latencyMs: 200, errorMessage: null, timestamp: null },
      { toolName: "write", isError: true, latencyMs: 300, errorMessage: "Permission denied", timestamp: null },
    ];

    const metrics = aggregateToolMetrics(invocations);
    expect(metrics).toHaveLength(2);

    const readMetric = metrics.find((m) => m.toolName === "read")!;
    expect(readMetric.invocations).toBe(2);
    expect(readMetric.errorCount).toBe(0);
    expect(readMetric.errorRate).toBe(0);
    expect(readMetric.avgLatencyMs).toBe(150);

    const writeMetric = metrics.find((m) => m.toolName === "write")!;
    expect(writeMetric.invocations).toBe(1);
    expect(writeMetric.errorCount).toBe(1);
    expect(writeMetric.errorRate).toBe(1);
    expect(writeMetric.lastError).toBe("Permission denied");
  });

  it("sorts by invocation count descending", () => {
    const invocations = [
      { toolName: "a", isError: false, latencyMs: null, errorMessage: null, timestamp: null },
      { toolName: "b", isError: false, latencyMs: null, errorMessage: null, timestamp: null },
      { toolName: "b", isError: false, latencyMs: null, errorMessage: null, timestamp: null },
      { toolName: "b", isError: false, latencyMs: null, errorMessage: null, timestamp: null },
    ];

    const metrics = aggregateToolMetrics(invocations);
    expect(metrics[0]!.toolName).toBe("b");
    expect(metrics[0]!.invocations).toBe(3);
  });

  it("color-codes error rates correctly", () => {
    // Green: <5%
    const invocations = Array.from({ length: 100 }, (_, i) => ({
      toolName: "tool",
      isError: i < 3,
      latencyMs: null,
      errorMessage: i < 3 ? "err" : null,
      timestamp: null,
    }));

    const metrics = aggregateToolMetrics(invocations);
    expect(metrics[0]!.errorRate).toBe(0.03);
  });
});
