import { describe, it, expect } from "vitest";

import {
  parseTrace,
  type EnhancedTranscriptMessage,
} from "@/features/sessions/lib/traceParser";

function msg(
  overrides: Partial<EnhancedTranscriptMessage> & { role: string },
): EnhancedTranscriptMessage {
  return {
    id: crypto.randomUUID(),
    content: "",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("traceParser", () => {
  it("parses plain text user/assistant turns", () => {
    const messages: EnhancedTranscriptMessage[] = [
      msg({ role: "user", content: "Hello", timestamp: "2026-01-01T00:00:00Z" }),
      msg({
        role: "assistant",
        content: "Hi there",
        timestamp: "2026-01-01T00:00:01Z",
        model: "claude-opus-4-6",
        usage: {
          input: 10,
          output: 20,
          cacheRead: 0,
          cacheWrite: 5,
          totalTokens: 35,
          cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0.0005, total: 0.0035 },
        },
      }),
    ];

    const { turns, summary } = parseTrace(messages, "sess-1");

    expect(turns).toHaveLength(2);
    expect(turns[0].role).toBe("user");
    expect(turns[0].content).toBe("Hello");
    expect(turns[1].role).toBe("assistant");
    expect(turns[1].content).toBe("Hi there");
    expect(turns[1].model).toBe("claude-opus-4-6");
    expect(turns[1].tokens.total).toBe(35);
    expect(turns[1].cost.total).toBe(0.0035);

    expect(summary.totalTurns).toBe(2);
    expect(summary.totalTokens).toBe(35);
    expect(summary.totalCost).toBe(0.0035);
    expect(summary.model).toBe("claude-opus-4-6");
    expect(summary.turnBreakdown).toEqual({ user: 1, assistant: 1, system: 0, tool: 0 });
  });

  it("parses assistant turns with tool calls", () => {
    const messages: EnhancedTranscriptMessage[] = [
      msg({ role: "user", content: "Search for cats", timestamp: "2026-01-01T00:00:00Z" }),
      msg({
        role: "assistant",
        content: [
          { type: "text", text: "Let me search..." },
          { type: "toolCall", id: "tc-1", name: "web_search", arguments: JSON.stringify({ query: "cats" }) },
        ],
        timestamp: "2026-01-01T00:00:01Z",
      }),
      msg({
        role: "toolResult",
        content: "Found 10 results",
        timestamp: "2026-01-01T00:00:03Z",
        toolCallId: "tc-1",
      } as EnhancedTranscriptMessage & { toolCallId: string }),
      msg({
        role: "assistant",
        content: "Here are the results!",
        timestamp: "2026-01-01T00:00:04Z",
      }),
    ];

    const { turns } = parseTrace(messages, "sess-2");

    // toolResult messages are folded into the assistant turn, not separate
    expect(turns).toHaveLength(3); // user, assistant (with tool), assistant
    expect(turns[1].toolCalls).toHaveLength(1);
    expect(turns[1].toolCalls[0].name).toBe("web_search");
    expect(turns[1].toolCalls[0].result).toBe("Found 10 results");
    expect(turns[1].toolCalls[0].durationMs).toBe(2000);
  });

  it("aggregates cost and tokens across turns", () => {
    const mkUsage = (input: number, output: number) => ({
      input,
      output,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: input + output,
      cost: { input: input * 0.001, output: output * 0.001, cacheRead: 0, cacheWrite: 0, total: (input + output) * 0.001 },
    });

    const messages: EnhancedTranscriptMessage[] = [
      msg({ role: "user", content: "Q1", timestamp: "2026-01-01T00:00:00Z" }),
      msg({ role: "assistant", content: "A1", timestamp: "2026-01-01T00:00:01Z", usage: mkUsage(10, 20) }),
      msg({ role: "user", content: "Q2", timestamp: "2026-01-01T00:00:02Z" }),
      msg({ role: "assistant", content: "A2", timestamp: "2026-01-01T00:00:03Z", usage: mkUsage(15, 25) }),
    ];

    const { summary } = parseTrace(messages, "sess-3");
    expect(summary.totalTokens).toBe(70); // 30 + 40
    expect(summary.totalCost).toBeCloseTo(0.070);
    expect(summary.totalDurationMs).toBe(3000);
  });

  it("calculates latency between assistant turns", () => {
    const messages: EnhancedTranscriptMessage[] = [
      msg({ role: "user", content: "Q", timestamp: "2026-01-01T00:00:00Z" }),
      msg({ role: "assistant", content: "A1", timestamp: "2026-01-01T00:00:02Z" }),
      msg({ role: "user", content: "Q2", timestamp: "2026-01-01T00:00:05Z" }),
      msg({ role: "assistant", content: "A2", timestamp: "2026-01-01T00:00:08Z" }),
    ];

    const { turns } = parseTrace(messages, "sess-4");
    expect(turns[1].latencyMs).toBeNull(); // First assistant turn has no prior
    expect(turns[3].latencyMs).toBe(6000); // 8s - 2s
  });

  it("extracts thinking content from content blocks", () => {
    const messages: EnhancedTranscriptMessage[] = [
      msg({ role: "user", content: "Think about this", timestamp: "2026-01-01T00:00:00Z" }),
      msg({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Internal reasoning..." },
          { type: "text", text: "Here is my answer" },
        ],
        timestamp: "2026-01-01T00:00:01Z",
      }),
    ];

    const { turns } = parseTrace(messages, "sess-5");
    expect(turns[1].thinkingContent).toBe("Internal reasoning...");
    expect(turns[1].content).toBe("Here is my answer");
  });

  it("handles empty messages gracefully", () => {
    const { turns, summary } = parseTrace([], "sess-empty");
    expect(turns).toHaveLength(0);
    expect(summary.totalTurns).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.totalCost).toBe(0);
    expect(summary.totalDurationMs).toBe(0);
  });

  it("handles messages without usage data", () => {
    const messages: EnhancedTranscriptMessage[] = [
      msg({ role: "user", content: "Hello", timestamp: "2026-01-01T00:00:00Z" }),
      msg({ role: "assistant", content: "Hi", timestamp: "2026-01-01T00:00:01Z" }),
    ];

    const { turns } = parseTrace(messages, "sess-6");
    expect(turns[0].tokens.total).toBe(0);
    expect(turns[0].cost.total).toBe(0);
    expect(turns[1].tokens.total).toBe(0);
  });

  it("extracts text from content block arrays", () => {
    const messages: EnhancedTranscriptMessage[] = [
      msg({
        role: "assistant",
        content: [
          { type: "text", text: "Part 1" },
          { type: "text", text: "Part 2" },
        ],
        timestamp: "2026-01-01T00:00:00Z",
      }),
    ];

    const { turns } = parseTrace(messages, "sess-7");
    expect(turns[0].content).toBe("Part 1\nPart 2");
  });
});
