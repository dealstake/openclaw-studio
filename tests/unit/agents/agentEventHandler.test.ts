import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleRuntimeAgentEvent } from "@/features/agents/state/agentEventHandler";
import { RuntimeTrackingState } from "@/features/agents/state/runtimeTrackingState";
import type { GatewayRuntimeEventHandlerDeps } from "@/features/agents/state/gatewayRuntimeEventHandler.types";
import type { AgentState } from "@/features/agents/state/store";
import type { AgentEventPayload } from "@/features/agents/state/runtimeEventBridge.types";

const makeAgent = (overrides: Partial<AgentState> = {}): AgentState =>
  ({
    agentId: "agent-1",
    sessionKey: "agent:agent-1:main",
    runId: "run-1",
    status: "running",
    streamText: null,
    thinkingTrace: null,
    messageParts: [],
    lastUserMessage: null,
    latestOverride: null,
    sessionCreated: true,
    lastResult: null,
    lastActivityAt: 900,
    ...overrides,
  }) as AgentState;

function makeDeps(agents: AgentState[] = []): GatewayRuntimeEventHandlerDeps {
  return {
    getStatus: () => "connected",
    getAgents: () => agents,
    dispatch: vi.fn(),
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
    onActivityEvent: vi.fn(),
    onSubAgentLifecycle: vi.fn(),
    onSessionsUpdate: vi.fn(),
  };
}

describe("handleRuntimeAgentEvent", () => {
  let deps: GatewayRuntimeEventHandlerDeps;
  let state: RuntimeTrackingState;
  const agent = makeAgent();

  beforeEach(() => {
    deps = makeDeps([agent]);
    state = new RuntimeTrackingState(deps);
  });

  it("ignores events without runId", () => {
    handleRuntimeAgentEvent({} as AgentEventPayload, state);
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  describe("sub-agent lifecycle routing", () => {
    it("routes sub-agent lifecycle to onSubAgentLifecycle", () => {
      const noDeps = makeDeps([]);
      const noState = new RuntimeTrackingState(noDeps);
      handleRuntimeAgentEvent(
        {
          runId: "run-sub",
          sessionKey: "agent:a1:subagent:s1",
          stream: "lifecycle",
          data: { phase: "start" },
        } as AgentEventPayload,
        noState
      );
      expect(noDeps.onSubAgentLifecycle).toHaveBeenCalledWith("agent:a1:subagent:s1", "start");
      expect(noDeps.onSessionsUpdate).toHaveBeenCalled();
    });
  });

  describe("cron/subagent activity feed routing", () => {
    it("routes cron tool events to activity feed", () => {
      const noDeps = makeDeps([]);
      const noState = new RuntimeTrackingState(noDeps);
      handleRuntimeAgentEvent(
        {
          runId: "run-cron",
          sessionKey: "agent:a1:cron:job1",
          stream: "tool",
          data: { name: "web_search", phase: "start" },
        } as AgentEventPayload,
        noState
      );
      expect(noDeps.onActivityEvent).toHaveBeenCalledWith(
        "agent:a1:cron:job1",
        expect.objectContaining({ lastToolName: "web_search" })
      );
    });

    it("routes cron lifecycle start to activity feed", () => {
      const noDeps = makeDeps([]);
      const noState = new RuntimeTrackingState(noDeps);
      handleRuntimeAgentEvent(
        {
          runId: "run-cron",
          sessionKey: "agent:a1:cron:job1",
          stream: "lifecycle",
          data: { phase: "start" },
        } as AgentEventPayload,
        noState
      );
      expect(noDeps.onActivityEvent).toHaveBeenCalledWith(
        "agent:a1:cron:job1",
        expect.objectContaining({ status: "running" })
      );
    });
  });

  describe("reasoning stream", () => {
    it("queues live patch with thinking trace for reasoning stream", () => {
      handleRuntimeAgentEvent(
        {
          runId: "run-1",
          sessionKey: "agent:agent-1:main",
          stream: "reasoning",
          data: { text: "Let me think..." },
        } as AgentEventPayload,
        state
      );
      expect(deps.queueLivePatch).toHaveBeenCalledWith(
        "agent-1",
        expect.objectContaining({
          status: "running",
          thinkingTrace: "Let me think...",
        })
      );
    });

    it("accumulates reasoning deltas", () => {
      handleRuntimeAgentEvent(
        {
          runId: "run-1",
          sessionKey: "agent:agent-1:main",
          stream: "reasoning",
          data: { delta: "First " },
        } as AgentEventPayload,
        state
      );
      handleRuntimeAgentEvent(
        {
          runId: "run-1",
          sessionKey: "agent:agent-1:main",
          stream: "reasoning",
          data: { delta: "second" },
        } as AgentEventPayload,
        state
      );
      expect(state.thinkingStreamByRun.get("run-1")).toBe("First second");
    });
  });

  describe("assistant stream", () => {
    it("queues live patch for assistant text", () => {
      // Mark chatRunSeen so shouldPublishAssistantStream may allow it
      state.chatRunSeen.add("run-1");
      handleRuntimeAgentEvent(
        {
          runId: "run-1",
          sessionKey: "agent:agent-1:main",
          stream: "assistant",
          data: { text: "Hello world" },
        } as AgentEventPayload,
        state
      );
      expect(deps.queueLivePatch).toHaveBeenCalledWith(
        "agent-1",
        expect.objectContaining({ status: "running" })
      );
    });
  });

  describe("tool stream", () => {
    it("dispatches tool invocation for start phase", () => {
      handleRuntimeAgentEvent(
        {
          runId: "run-1",
          sessionKey: "agent:agent-1:main",
          stream: "tool",
          data: { phase: "start", name: "web_search", toolCallId: "tc-1", args: { query: "test" } },
        } as AgentEventPayload,
        state
      );
      // appendOrUpdatePart dispatches appendPart
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "appendPart",
          agentId: "agent-1",
          part: expect.objectContaining({
            type: "tool-invocation",
            name: "web_search",
            phase: "pending",
          }),
        })
      );
    });

    it("dispatches tool result for result phase", () => {
      handleRuntimeAgentEvent(
        {
          runId: "run-1",
          sessionKey: "agent:agent-1:main",
          stream: "tool",
          data: { phase: "result", name: "web_search", toolCallId: "tc-1", result: "search results" },
        } as AgentEventPayload,
        state
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "appendPart",
          agentId: "agent-1",
          part: expect.objectContaining({
            type: "tool-invocation",
            name: "web_search",
            phase: "complete",
            result: "search results",
          }),
        })
      );
    });

    it("dispatches error phase for isError result", () => {
      handleRuntimeAgentEvent(
        {
          runId: "run-1",
          sessionKey: "agent:agent-1:main",
          stream: "tool",
          data: { phase: "result", name: "exec", toolCallId: "tc-2", result: "fail", isError: true },
        } as AgentEventPayload,
        state
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "appendPart",
          part: expect.objectContaining({ phase: "error" }),
        })
      );
    });
  });

  describe("lifecycle stream", () => {
    it("dispatches status part on lifecycle end", () => {
      handleRuntimeAgentEvent(
        {
          runId: "run-1",
          sessionKey: "agent:agent-1:main",
          stream: "lifecycle",
          data: { phase: "end", model: "claude-opus-4" },
        } as AgentEventPayload,
        state
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "appendPart",
          agentId: "agent-1",
          part: expect.objectContaining({ type: "status", state: "complete" }),
        })
      );
    });

    it("dispatches error status on lifecycle error", () => {
      handleRuntimeAgentEvent(
        {
          runId: "run-1",
          sessionKey: "agent:agent-1:main",
          stream: "lifecycle",
          data: { phase: "error" },
        } as AgentEventPayload,
        state
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "appendPart",
          part: expect.objectContaining({ type: "status", state: "error" }),
        })
      );
    });

    it("finalizes streaming parts on lifecycle end", () => {
      const agentWithParts = makeAgent({
        messageParts: [
          { type: "text", text: "hello", streaming: true },
          { type: "reasoning", text: "thinking", streaming: true },
        ],
      });
      const localDeps = makeDeps([agentWithParts]);
      const localState = new RuntimeTrackingState(localDeps);
      handleRuntimeAgentEvent(
        {
          runId: "run-1",
          sessionKey: "agent:agent-1:main",
          stream: "lifecycle",
          data: { phase: "end" },
        } as AgentEventPayload,
        localState
      );
      // Should have updatePart calls to set streaming: false
      const updatePartCalls = (localDeps.dispatch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0].type === "updatePart"
      );
      expect(updatePartCalls.length).toBe(2);
      expect(updatePartCalls[0][0].patch).toEqual(expect.objectContaining({ streaming: false }));
    });
  });

  it("matches agent by runId when sessionKey doesn't match", () => {
    const agentByRun = makeAgent({ agentId: "a1", sessionKey: "agent:a1:main", runId: "run-special" });
    const localDeps = makeDeps([agentByRun]);
    const localState = new RuntimeTrackingState(localDeps);
    handleRuntimeAgentEvent(
      {
        runId: "run-special",
        sessionKey: "agent:a1:some-other-key",
        stream: "reasoning",
        data: { text: "thinking" },
      } as AgentEventPayload,
      localState
    );
    expect(localDeps.queueLivePatch).toHaveBeenCalledWith("a1", expect.anything());
  });
});
