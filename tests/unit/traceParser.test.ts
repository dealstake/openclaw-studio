import { describe, it, expect } from "vitest";
import { turnsToTree, parseTrace } from "@/features/sessions/lib/traceParser";
import type { TraceTurn, EnhancedTranscriptMessage } from "@/features/sessions/lib/traceParser";

describe("turnsToTree", () => {
  const baseTurn: TraceTurn = {
    index: 0,
    role: "user",
    content: "Hello",
    toolCalls: [],
    tokens: { input: 10, output: 0, cacheRead: 0, cacheWrite: 0, total: 10 },
    cost: { input: 0.001, output: 0, total: 0.001 },
    model: null,
    stopReason: null,
    timestamp: 1706745600000,
    latencyMs: null,
  };

  it("converts a simple user turn to a leaf node", () => {
    const tree = turnsToTree([baseTurn]);
    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe("message");
    expect(tree[0].role).toBe("user");
    expect(tree[0].children).toHaveLength(0);
    expect(tree[0].depth).toBe(0);
  });

  it("nests thinking as a child of assistant", () => {
    const turn: TraceTurn = {
      ...baseTurn,
      index: 1,
      role: "assistant",
      content: "Response",
      thinkingContent: "Let me think...",
    };
    const tree = turnsToTree([turn]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].type).toBe("thinking");
    expect(tree[0].children[0].content).toBe("Let me think...");
    expect(tree[0].children[0].depth).toBe(1);
  });

  it("nests tool calls as children", () => {
    const turn: TraceTurn = {
      ...baseTurn,
      index: 1,
      role: "assistant",
      content: "I'll read that file",
      toolCalls: [
        { id: "tc-1", name: "Read", arguments: { path: "/foo" }, result: "bar", durationMs: 50 },
        { id: "tc-2", name: "Write", arguments: { path: "/baz" } },
      ],
    };
    const tree = turnsToTree([turn]);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].type).toBe("tool_call");
    expect(tree[0].children[0].toolCall?.name).toBe("Read");
    expect(tree[0].children[1].toolCall?.name).toBe("Write");
  });

  it("orders thinking before tool calls", () => {
    const turn: TraceTurn = {
      ...baseTurn,
      role: "assistant",
      content: "Response",
      thinkingContent: "Thinking...",
      toolCalls: [{ id: "tc-1", name: "Read", arguments: {} }],
    };
    const tree = turnsToTree([turn]);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].type).toBe("thinking");
    expect(tree[0].children[1].type).toBe("tool_call");
  });

  it("assigns unique ids to all nodes", () => {
    const turns: TraceTurn[] = [
      baseTurn,
      { ...baseTurn, index: 1, role: "assistant", content: "Hi", thinkingContent: "hmm", toolCalls: [{ id: "tc-1", name: "Read", arguments: {} }] },
    ];
    const tree = turnsToTree(turns);
    const ids = new Set<string>();
    function collect(nodes: ReturnType<typeof turnsToTree>) {
      for (const n of nodes) {
        ids.add(n.id);
        collect(n.children);
      }
    }
    collect(tree);
    // 2 message + 1 thinking + 1 tool_call = 4 unique ids
    expect(ids.size).toBe(4);
  });

  it("preserves tokens and cost on message nodes", () => {
    const tree = turnsToTree([baseTurn]);
    expect(tree[0].tokens?.total).toBe(10);
    expect(tree[0].cost?.total).toBe(0.001);
  });
});

describe("parseTrace", () => {
  it("parses basic messages into turns and summary", () => {
    const messages: EnhancedTranscriptMessage[] = [
      { id: "1", role: "user", content: "Hello", timestamp: "2024-02-01T00:00:00Z" },
      {
        id: "2",
        role: "assistant",
        content: "Hi there",
        timestamp: "2024-02-01T00:00:02Z",
        model: "claude-opus-4-6",
        usage: {
          input: 100,
          output: 50,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 150,
          cost: { input: 0.003, output: 0.001, cacheRead: 0, cacheWrite: 0, total: 0.004 },
        },
      },
    ];
    const { turns, summary } = parseTrace(messages, "sess-1");
    expect(turns).toHaveLength(2);
    expect(summary.totalTurns).toBe(2);
    expect(summary.totalTokens).toBe(150);
    expect(summary.model).toBe("claude-opus-4-6");
  });
});
