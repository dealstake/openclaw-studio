/**
 * Tests for MessagePart generation from gateway event handler.
 *
 * Verifies that gatewayRuntimeEventHandler correctly populates
 * messageParts[] from EventFrame payloads for:
 * - Text streaming (assistant stream)
 * - Tool call lifecycle (start → running → result)
 * - Reasoning with shimmer (thinking stream)
 * - Lifecycle end (finalization + status part)
 * - Chat final event (text + reasoning parts)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGatewayRuntimeEventHandler,
  type GatewayRuntimeEventHandlerDeps,
  type GatewayRuntimeEventHandler,
} from "@/features/agents/state/gatewayRuntimeEventHandler";
import type { AgentState } from "@/features/agents/state/store";
import type { EventFrame } from "@/lib/gateway/GatewayClient";
import type { MessagePart } from "@/lib/chat/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_AGENT_ID = "alex";
const TEST_SESSION_KEY = "agent:alex:main";
const TEST_RUN_ID = "run-001";

function createMockAgent(overrides?: Partial<AgentState>): AgentState {
  return {
    agentId: TEST_AGENT_ID,
    sessionKey: TEST_SESSION_KEY,
    runId: TEST_RUN_ID,
    status: "running",
    outputLines: [],
    messageParts: [],
    streamText: null,
    thinkingTrace: null,
    lastResult: null,
    lastUserMessage: null,
    latestOverride: null,
    lastActivityAt: 0,
    lastAssistantMessageAt: null,
    sessionCreated: true,
    ...overrides,
  } as AgentState;
}

/**
 * Builds mock deps that track dispatched actions.
 * `agents` is mutable so tests can evolve agent state between events.
 */
function createMockDeps(agents: AgentState[]) {
  const dispatched: Array<{
    type: string;
    agentId?: string;
    part?: MessagePart;
    index?: number;
    patch?: Partial<MessagePart>;
    line?: string;
  }> = [];

  const deps: GatewayRuntimeEventHandlerDeps = {
    getStatus: () => "connected",
    getAgents: () => agents,
    dispatch: (action) => {
      dispatched.push(action as (typeof dispatched)[number]);
      // Simulate store: apply appendPart / updatePart to the agent
      if (action.type === "appendPart") {
        const agent = agents.find((a) => a.agentId === action.agentId);
        if (agent) agent.messageParts = [...agent.messageParts, action.part];
      }
      if (action.type === "updatePart") {
        const agent = agents.find((a) => a.agentId === action.agentId);
        if (agent && agent.messageParts[action.index]) {
          agent.messageParts = agent.messageParts.map((p, i) =>
            i === action.index ? Object.assign({}, p, action.patch) as MessagePart : p,
          );
        }
      }
    },
    queueLivePatch: vi.fn(),
    clearPendingLivePatch: vi.fn(),
    now: () => 1000,
    loadSummarySnapshot: vi.fn().mockResolvedValue(undefined),
    loadAgentHistory: vi.fn().mockResolvedValue(undefined),
    refreshHeartbeatLatestUpdate: vi.fn(),
    bumpHeartbeatTick: vi.fn(),
    setTimeout: vi.fn().mockReturnValue(1),
    clearTimeout: vi.fn(),
    isDisconnectLikeError: () => false,
    logWarn: vi.fn(),
    updateSpecialLatestUpdate: vi.fn(),
  };

  return { deps, dispatched };
}

function agentEvent(
  stream: string,
  data: Record<string, unknown>,
): EventFrame {
  return {
    type: "event",
    event: "agent",
    payload: {
      runId: TEST_RUN_ID,
      sessionKey: TEST_SESSION_KEY,
      stream,
      data,
    },
  } as EventFrame;
}

function chatEvent(
  state: string,
  message: Record<string, unknown>,
  overrides?: Record<string, unknown>,
): EventFrame {
  return {
    type: "event",
    event: "chat",
    payload: {
      sessionKey: TEST_SESSION_KEY,
      runId: TEST_RUN_ID,
      state,
      message,
      ...overrides,
    },
  } as EventFrame;
}

/** Filter dispatched actions to just appendPart/updatePart */
function partActions(dispatched: Array<{ type: string; part?: MessagePart; patch?: Partial<MessagePart> }>) {
  return dispatched.filter((a) => a.type === "appendPart" || a.type === "updatePart");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MessagePart generation from gateway events", () => {
  let agents: AgentState[];
  let handler: GatewayRuntimeEventHandler;
  let dispatched: ReturnType<typeof createMockDeps>["dispatched"];
  let deps: GatewayRuntimeEventHandlerDeps;

  beforeEach(() => {
    agents = [createMockAgent()];
    const mock = createMockDeps(agents);
    dispatched = mock.dispatched;
    deps = mock.deps;
    handler = createGatewayRuntimeEventHandler(deps);
  });

  // ── Assistant text streaming ──────────────────────────────────────

  describe("assistant text streaming", () => {
    it("appends a text part on first assistant delta", () => {
      handler.handleEvent(
        agentEvent("assistant", { delta: "Hello" }),
      );

      const parts = partActions(dispatched);
      expect(parts.length).toBeGreaterThanOrEqual(1);
      const textPart = parts.find(
        (a) => a.type === "appendPart" && a.part?.type === "text",
      );
      // Could be appendPart or via queueLivePatch → appendOrUpdatePart
      // The handler calls appendOrUpdatePart for text — first call = appendPart
      expect(textPart?.part).toMatchObject({
        type: "text",
        streaming: true,
      });
    });

    it("updates existing text part on subsequent deltas", () => {
      handler.handleEvent(
        agentEvent("assistant", { delta: "Hello" }),
      );
      handler.handleEvent(
        agentEvent("assistant", { delta: " world" }),
      );

      const updates = dispatched.filter((a) => a.type === "updatePart" && a.patch?.type === "text");
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Reasoning (thinking) stream ───────────────────────────────────

  describe("reasoning stream", () => {
    it("appends a reasoning part from thinking stream", () => {
      handler.handleEvent(
        agentEvent("reasoning", { text: "Let me think about this..." }),
      );

      const parts = partActions(dispatched);
      const reasoningPart = parts.find(
        (a) => a.part?.type === "reasoning" || a.patch?.type === "reasoning",
      );
      expect(reasoningPart).toBeDefined();
    });

    it("marks reasoning as streaming", () => {
      handler.handleEvent(
        agentEvent("reasoning", { text: "Analyzing..." }),
      );

      const appended = dispatched.find(
        (a) => a.type === "appendPart" && a.part?.type === "reasoning",
      );
      if (appended?.part?.type === "reasoning") {
        expect(appended.part.streaming).toBe(true);
      }
    });

    it("updates reasoning on subsequent reasoning events", () => {
      handler.handleEvent(
        agentEvent("reasoning", { text: "Step 1" }),
      );
      handler.handleEvent(
        agentEvent("reasoning", { text: "Step 1\nStep 2" }),
      );

      const updates = dispatched.filter(
        (a) => a.type === "updatePart",
      );
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Tool call lifecycle ───────────────────────────────────────────

  describe("tool call lifecycle", () => {
    it("appends tool-invocation part on tool start", () => {
      handler.handleEvent(
        agentEvent("tool", {
          phase: "start",
          name: "web_search",
          toolCallId: "tc-001",
          arguments: { query: "test" },
        }),
      );

      const toolPart = dispatched.find(
        (a) => a.type === "appendPart" && a.part?.type === "tool-invocation",
      );
      expect(toolPart).toBeDefined();
      if (toolPart?.part?.type === "tool-invocation") {
        expect(toolPart.part.name).toBe("web_search");
        expect(toolPart.part.phase).toBe("pending");
        expect(toolPart.part.toolCallId).toBe("tc-001");
      }
    });

    it("updates tool part to complete on result phase", () => {
      // Start
      handler.handleEvent(
        agentEvent("tool", {
          phase: "start",
          name: "web_search",
          toolCallId: "tc-001",
          arguments: { query: "test" },
        }),
      );
      // Result
      handler.handleEvent(
        agentEvent("tool", {
          phase: "result",
          name: "web_search",
          toolCallId: "tc-001",
          result: { text: "Search results here" },
        }),
      );

      const resultUpdate = dispatched.filter(
        (a) =>
          (a.type === "updatePart" && a.patch?.type === "tool-invocation") ||
          (a.type === "appendPart" && a.part?.type === "tool-invocation"),
      );
      // The last tool-invocation action should have phase "complete"
      const last = resultUpdate[resultUpdate.length - 1];
      const part = last?.type === "updatePart" ? last.patch : last?.part;
      expect(part).toMatchObject({ phase: "complete" });
    });

    it("marks tool as error when isError is true", () => {
      handler.handleEvent(
        agentEvent("tool", {
          phase: "start",
          name: "exec",
          toolCallId: "tc-002",
        }),
      );
      handler.handleEvent(
        agentEvent("tool", {
          phase: "result",
          name: "exec",
          toolCallId: "tc-002",
          result: "Command failed",
          isError: true,
        }),
      );

      const resultActions = dispatched.filter(
        (a) =>
          (a.type === "updatePart" || a.type === "appendPart") &&
          ((a.part as { phase?: string })?.phase === "error" ||
            (a.patch as { phase?: string })?.phase === "error"),
      );
      expect(resultActions.length).toBeGreaterThanOrEqual(1);
    });

    it("sets completedAt on tool result", () => {
      handler.handleEvent(
        agentEvent("tool", {
          phase: "start",
          name: "Read",
          toolCallId: "tc-003",
        }),
      );
      handler.handleEvent(
        agentEvent("tool", {
          phase: "result",
          name: "Read",
          toolCallId: "tc-003",
          result: { text: "file content" },
        }),
      );

      const agent = agents[0];
      const toolPart = agent.messageParts.find(
        (p) => p.type === "tool-invocation" && p.toolCallId === "tc-003",
      );
      expect(toolPart).toBeDefined();
      if (toolPart?.type === "tool-invocation") {
        expect(toolPart.completedAt).toBe(1000);
      }
    });
  });

  // ── Lifecycle end (finalization) ──────────────────────────────────

  describe("lifecycle end", () => {
    it("finalizes streaming parts on lifecycle end", () => {
      // Simulate some streaming parts
      handler.handleEvent(
        agentEvent("reasoning", { text: "Thinking..." }),
      );
      handler.handleEvent(
        agentEvent("assistant", { delta: "Response text" }),
      );

      // Now send lifecycle end
      handler.handleEvent(
        agentEvent("lifecycle", { phase: "end", model: "claude-opus-4" }),
      );

      // Check that streaming parts were marked non-streaming
      const agent = agents[0];
      const streamingParts = agent.messageParts.filter(
        (p) => (p.type === "text" || p.type === "reasoning") && p.streaming,
      );
      expect(streamingParts).toHaveLength(0);
    });

    it("appends a status part on lifecycle end", () => {
      handler.handleEvent(
        agentEvent("assistant", { delta: "Hello" }),
      );
      handler.handleEvent(
        agentEvent("lifecycle", { phase: "end", model: "claude-opus-4" }),
      );

      const agent = agents[0];
      const statusPart = agent.messageParts.find((p) => p.type === "status");
      expect(statusPart).toBeDefined();
      if (statusPart?.type === "status") {
        expect(statusPart.state).toBe("complete");
        expect(statusPart.model).toBe("claude-opus-4");
      }
    });

    it("appends error status on lifecycle error", () => {
      handler.handleEvent(
        agentEvent("lifecycle", { phase: "error" }),
      );

      const agent = agents[0];
      const statusPart = agent.messageParts.find((p) => p.type === "status");
      expect(statusPart).toBeDefined();
      if (statusPart?.type === "status") {
        expect(statusPart.state).toBe("error");
      }
    });
  });

  // ── Chat final event ──────────────────────────────────────────────

  describe("chat final event", () => {
    it("appends text and reasoning parts from chat final", () => {
      handler.handleEvent(
        chatEvent("final", {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "I considered the options" },
            { type: "text", text: "Here is my answer" },
          ],
        }),
      );

      const agent = agents[0];
      const reasoningParts = agent.messageParts.filter((p) => p.type === "reasoning");
      const textParts = agent.messageParts.filter((p) => p.type === "text");
      expect(reasoningParts.length).toBeGreaterThanOrEqual(1);
      expect(textParts.length).toBeGreaterThanOrEqual(1);
    });

    it("marks chat final parts as non-streaming", () => {
      handler.handleEvent(
        chatEvent("final", {
          role: "assistant",
          content: [
            { type: "text", text: "Final answer" },
          ],
        }),
      );

      const agent = agents[0];
      const textPart = agent.messageParts.find((p) => p.type === "text");
      if (textPart?.type === "text") {
        expect(textPart.streaming).toBe(false);
      }
    });
  });

  // ── Multiple tool calls in one run ────────────────────────────────

  describe("multiple tool calls", () => {
    it("tracks separate tool invocations by toolCallId", () => {
      handler.handleEvent(
        agentEvent("tool", {
          phase: "start",
          name: "Read",
          toolCallId: "tc-a",
        }),
      );
      handler.handleEvent(
        agentEvent("tool", {
          phase: "result",
          name: "Read",
          toolCallId: "tc-a",
          result: { text: "content a" },
        }),
      );
      handler.handleEvent(
        agentEvent("tool", {
          phase: "start",
          name: "Write",
          toolCallId: "tc-b",
          arguments: { path: "/tmp/test" },
        }),
      );

      const agent = agents[0];
      const toolParts = agent.messageParts.filter((p) => p.type === "tool-invocation");
      expect(toolParts.length).toBe(2);
      if (toolParts[0].type === "tool-invocation" && toolParts[1].type === "tool-invocation") {
        expect(toolParts[0].name).toBe("Read");
        expect(toolParts[1].name).toBe("Write");
      }
    });
  });

  // ── Cleanup ───────────────────────────────────────────────────────

  describe("cleanup", () => {
    it("dispose clears internal state without error", () => {
      handler.handleEvent(
        agentEvent("assistant", { delta: "test" }),
      );
      expect(() => handler.dispose()).not.toThrow();
    });

    it("clearRunTracking removes part index entries", () => {
      handler.handleEvent(
        agentEvent("assistant", { delta: "Hello" }),
      );
      handler.clearRunTracking(TEST_RUN_ID);
      // After clearing, a new event should append (not update)
      dispatched.length = 0;
      agents[0].messageParts = [];
      handler.handleEvent(
        agentEvent("assistant", { delta: "New run" }),
      );
      const appends = dispatched.filter((a) => a.type === "appendPart");
      expect(appends.length).toBeGreaterThanOrEqual(1);
    });
  });
});
