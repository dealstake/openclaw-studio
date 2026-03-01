import { describe, it, expect } from "vitest";
import { parseSpansFromJsonl } from "@/features/sessions/lib/spanParser";
import type { JsonlEntry } from "@/lib/sessions/traceParser";

// ─── Fixtures ─────────────────────────────────────────────────────────────

const SESSION_ID = "test-session-123";

/** Base JSONL entry for an assistant message with tool calls */
function makeAssistantEntry(opts: {
  id?: string;
  parentId?: string;
  timestamp?: string;
  model?: string;
  stopReason?: string;
  toolCallIds?: string[];
  toolCallNames?: string[];
  hasUsage?: boolean;
}): JsonlEntry {
  const {
    id = "msg-assistant-1",
    parentId = null,
    timestamp = "2024-02-01T00:00:02.000Z",
    model = "claude-sonnet-4-6",
    stopReason = "toolUse",
    toolCallIds = ["tc-1"],
    toolCallNames = ["read"],
    hasUsage = true,
  } = opts;

  const toolCallBlocks = toolCallIds.map((tcId, i) => ({
    type: "toolCall",
    id: tcId,
    name: toolCallNames[i] ?? "tool",
    arguments: { path: `/some/file-${i}` },
  }));

  return {
    type: "message",
    id,
    parentId,
    timestamp,
    message: {
      role: "assistant",
      content: [
        { type: "text", text: "I will read that file." },
        ...toolCallBlocks,
      ],
      model,
      stopReason,
      timestamp,
      ...(hasUsage
        ? {
            usage: {
              input: 100,
              output: 50,
              cacheRead: 1000,
              cacheWrite: 500,
              totalTokens: 1650,
              cost: {
                input: 0.0003,
                output: 0.00075,
                cacheRead: 0.0003,
                cacheWrite: 0.001875,
                total: 0.003225,
              },
            },
          }
        : {}),
    },
  };
}

/** Base JSONL entry for a toolResult message */
function makeToolResultEntry(opts: {
  id?: string;
  parentId?: string;
  timestamp?: string;
  toolCallId: string;
  toolName?: string;
  result?: string;
  isError?: boolean;
}): JsonlEntry {
  const {
    id = "msg-result-1",
    parentId = "msg-assistant-1",
    timestamp = "2024-02-01T00:00:03.500Z",
    toolCallId,
    toolName = "read",
    result = "file content here",
    isError = false,
  } = opts;

  return {
    type: "message",
    id,
    parentId,
    timestamp,
    message: {
      role: "toolResult",
      toolCallId,
      toolName,
      content: [{ type: "text", text: result }],
      isError,
      details: { status: isError ? "error" : "ok" },
      timestamp,
    } as unknown as JsonlEntry["message"],
  };
}

/** Minimal user message entry */
function makeUserEntry(opts: { id?: string; timestamp?: string; text?: string } = {}): JsonlEntry {
  const {
    id = "msg-user-1",
    timestamp = "2024-02-01T00:00:00.000Z",
    text = "Hello!",
  } = opts;
  return {
    type: "message",
    id,
    parentId: null,
    timestamp,
    message: {
      role: "user",
      content: [{ type: "text", text }],
      timestamp,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("parseSpansFromJsonl", () => {
  it("returns empty spans for an empty entry list", () => {
    const result = parseSpansFromJsonl([], SESSION_ID);
    expect(result.spans).toHaveLength(0);
    expect(result.summary.totalSpans).toBe(0);
    expect(result.summary.totalLlmCalls).toBe(0);
    expect(result.summary.totalToolCalls).toBe(0);
  });

  it("ignores non-message entries", () => {
    const entries: JsonlEntry[] = [
      { type: "session", id: "sess", timestamp: "2024-02-01T00:00:00.000Z" },
      { type: "model_change", id: "mc-1", parentId: null, timestamp: "2024-02-01T00:00:00.001Z" },
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    expect(result.spans).toHaveLength(0);
  });

  it("ignores user messages (no llm_call span created)", () => {
    const result = parseSpansFromJsonl([makeUserEntry()], SESSION_ID);
    expect(result.spans).toHaveLength(0);
    expect(result.summary.totalLlmCalls).toBe(0);
  });

  it("creates one llm_call span per assistant message", () => {
    const entries = [
      makeAssistantEntry({ id: "a1", toolCallIds: [], hasUsage: false }),
      makeAssistantEntry({ id: "a2", toolCallIds: [], hasUsage: false }),
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    const llmSpans = result.spans.filter((s) => s.kind === "llm_call");
    expect(llmSpans).toHaveLength(2);
    expect(llmSpans[0].turnIndex).toBe(0);
    expect(llmSpans[1].turnIndex).toBe(1);
  });

  it("sets correct fields on llm_call span", () => {
    const entries = [makeAssistantEntry({ id: "a1", toolCallIds: [] })];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    const span = result.spans[0];

    expect(span.kind).toBe("llm_call");
    expect(span.traceId).toBe(SESSION_ID);
    expect(span.parentSpanId).toBeNull();
    expect(span.spanId).toBe("span-llm-0");
    expect(span.name).toBe("claude-sonnet-4-6");
    expect(span.model).toBe("claude-sonnet-4-6");
    expect(span.stopReason).toBe("toolUse");
    expect(span.status).toBe("ok");
    expect(span.tokens?.total).toBe(1650);
    expect(span.cost?.total).toBeCloseTo(0.003225);
    expect(span.outputPayload).toContain("I will read that file.");
  });

  it("creates tool_call child spans for toolCall content blocks", () => {
    const entries = [
      makeAssistantEntry({
        id: "a1",
        toolCallIds: ["tc-1", "tc-2"],
        toolCallNames: ["read", "exec"],
      }),
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    const toolSpans = result.spans.filter((s) => s.kind === "tool_call");

    expect(toolSpans).toHaveLength(2);
    expect(toolSpans[0].name).toBe("read");
    expect(toolSpans[1].name).toBe("exec");
    expect(toolSpans[0].parentSpanId).toBe("span-llm-0");
    expect(toolSpans[1].parentSpanId).toBe("span-llm-0");
    expect(toolSpans[0].status).toBe("pending");
    expect(toolSpans[0].inputPayload).toBeDefined();
  });

  it("closes tool_call span on matching toolResult", () => {
    const entries = [
      makeAssistantEntry({ id: "a1", toolCallIds: ["tc-1"] }),
      makeToolResultEntry({
        id: "r1",
        parentId: "a1",
        toolCallId: "tc-1",
        result: "file contents here",
        timestamp: "2024-02-01T00:00:03.500Z",
      }),
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    const toolSpan = result.spans.find((s) => s.kind === "tool_call");

    expect(toolSpan).toBeDefined();
    expect(toolSpan!.status).toBe("ok");
    expect(toolSpan!.endTime).not.toBeNull();
    expect(toolSpan!.durationMs).toBeGreaterThan(0);
    expect(toolSpan!.outputPayload).toContain("file contents here");
  });

  it("marks tool_call span as error when isError=true", () => {
    const entries = [
      makeAssistantEntry({ id: "a1", toolCallIds: ["tc-1"] }),
      makeToolResultEntry({
        toolCallId: "tc-1",
        result: "ENOENT: file not found",
        isError: true,
        timestamp: "2024-02-01T00:00:03.500Z",
      }),
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    const toolSpan = result.spans.find((s) => s.kind === "tool_call");

    expect(toolSpan!.status).toBe("error");
  });

  it("leaves unmatched tool_call spans as pending", () => {
    const entries = [
      makeAssistantEntry({ id: "a1", toolCallIds: ["tc-unmatched"] }),
      // No toolResult for tc-unmatched
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    const toolSpan = result.spans.find((s) => s.kind === "tool_call");

    expect(toolSpan!.status).toBe("pending");
    expect(toolSpan!.endTime).toBeNull();
    expect(toolSpan!.durationMs).toBeNull();
  });

  it("updates llm_call span endTime to last toolResult timestamp", () => {
    const entries = [
      makeAssistantEntry({ id: "a1", toolCallIds: ["tc-1"] }),
      makeToolResultEntry({
        toolCallId: "tc-1",
        timestamp: "2024-02-01T00:00:04.000Z",
      }),
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    const llmSpan = result.spans.find((s) => s.kind === "llm_call");

    expect(llmSpan!.endTime).toBe(new Date("2024-02-01T00:00:04.000Z").getTime());
    expect(llmSpan!.durationMs).toBeGreaterThan(0);
  });

  it("computes summary token and cost totals correctly", () => {
    const entries = [
      makeAssistantEntry({ id: "a1", toolCallIds: [] }),
      makeAssistantEntry({ id: "a2", toolCallIds: [] }),
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);

    expect(result.summary.totalTokens).toBe(3300); // 1650 * 2
    expect(result.summary.totalCost).toBeCloseTo(0.00645); // 0.003225 * 2
    expect(result.summary.totalLlmCalls).toBe(2);
    expect(result.summary.totalToolCalls).toBe(0);
  });

  it("assigns correct spanIds to tool_call spans", () => {
    const entries = [
      makeAssistantEntry({ id: "a1", toolCallIds: ["tc-1", "tc-2", "tc-3"] }),
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    const toolSpans = result.spans.filter((s) => s.kind === "tool_call");

    expect(toolSpans[0].spanId).toBe("span-tool-0-0");
    expect(toolSpans[1].spanId).toBe("span-tool-0-1");
    expect(toolSpans[2].spanId).toBe("span-tool-0-2");
  });

  it("computes medianLlmLatencyMs for multiple turns", () => {
    // Two LLM turns: one with 1000ms duration, one with 3000ms duration
    const entries = [
      makeAssistantEntry({ id: "a1", toolCallIds: ["tc-1"], timestamp: "2024-02-01T00:00:00.000Z" }),
      makeToolResultEntry({ toolCallId: "tc-1", timestamp: "2024-02-01T00:00:01.000Z" }), // 1s
      makeAssistantEntry({ id: "a2", toolCallIds: ["tc-2"], timestamp: "2024-02-01T00:00:02.000Z" }),
      makeToolResultEntry({ toolCallId: "tc-2", timestamp: "2024-02-01T00:00:05.000Z" }), // 3s
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    // Sorted: [1000, 3000]. Median (50th pct of 2 values) = index ceil(0.5*2)-1=0 → 1000
    expect(result.summary.medianLlmLatencyMs).toBe(1000);
    expect(result.summary.p95LlmLatencyMs).toBe(3000);
  });

  it("handles assistant message with no content text gracefully", () => {
    const entry: JsonlEntry = {
      type: "message",
      id: "a1",
      parentId: null,
      timestamp: "2024-02-01T00:00:00.000Z",
      message: {
        role: "assistant",
        content: [],
        model: "claude-opus-4-6",
        stopReason: "end_turn",
        timestamp: "2024-02-01T00:00:00.000Z",
      },
    };
    const result = parseSpansFromJsonl([entry], SESSION_ID);
    expect(result.spans).toHaveLength(1);
    expect(result.spans[0].outputPayload).toBeUndefined();
  });

  it("does not share toolCallId state between multiple llm turns", () => {
    // Ensure tc-1 from turn 0 isn't accidentally matched by turn 1's toolResult
    const entries = [
      makeAssistantEntry({ id: "a1", toolCallIds: ["tc-1"] }),
      makeAssistantEntry({ id: "a2", toolCallIds: ["tc-2"] }),
      makeToolResultEntry({ id: "r2", toolCallId: "tc-2", timestamp: "2024-02-01T00:00:05.000Z" }),
    ];
    const result = parseSpansFromJsonl(entries, SESSION_ID);
    const toolSpans = result.spans.filter((s) => s.kind === "tool_call");

    // tc-1 is never matched → pending
    expect(toolSpans.find((s) => s.spanId === "span-tool-0-0")!.status).toBe("pending");
    // tc-2 is matched → ok
    expect(toolSpans.find((s) => s.spanId === "span-tool-1-0")!.status).toBe("ok");
  });
});
