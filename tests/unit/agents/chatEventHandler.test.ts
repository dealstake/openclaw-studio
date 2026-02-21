import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleRuntimeChatEvent } from "@/features/agents/state/chatEventHandler";
import { RuntimeTrackingState } from "@/features/agents/state/runtimeTrackingState";
import type { GatewayRuntimeEventHandlerDeps } from "@/features/agents/state/gatewayRuntimeEventHandler.types";
import type { AgentState } from "@/features/agents/state/store";
import type { ChatEventPayload } from "@/features/agents/state/runtimeEventBridge.types";

const makeAgent = (overrides: Partial<AgentState> = {}): AgentState =>
  ({
    agentId: "agent-1",
    sessionKey: "agent:agent-1:main",
    runId: "run-1",
    status: "idle",
    streamText: null,
    thinkingTrace: null,
    messageParts: [],
    lastUserMessage: null,
    latestOverride: null,
    sessionCreated: true,
    lastResult: null,
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
    onHeartbeatEvent: vi.fn(),
  };
}

describe("handleRuntimeChatEvent", () => {
  let deps: GatewayRuntimeEventHandlerDeps;
  let state: RuntimeTrackingState;
  const agent = makeAgent();

  beforeEach(() => {
    deps = makeDeps([agent]);
    state = new RuntimeTrackingState(deps);
  });

  it("ignores events without sessionKey", () => {
    handleRuntimeChatEvent({ sessionKey: "" } as ChatEventPayload, state);
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("routes cron events to activity feed when no agent match", () => {
    const cronDeps = makeDeps([]);
    const cronState = new RuntimeTrackingState(cronDeps);
    handleRuntimeChatEvent(
      {
        sessionKey: "agent:a1:cron:job1",
        state: "delta",
        message: { role: "assistant", content: "Working..." },
      } as ChatEventPayload,
      cronState
    );
    expect(cronDeps.onActivityEvent).toHaveBeenCalledWith(
      "agent:a1:cron:job1",
      expect.objectContaining({ streaming: true, status: "running" })
    );
  });

  it("routes subagent events to activity feed", () => {
    const subDeps = makeDeps([]);
    const subState = new RuntimeTrackingState(subDeps);
    handleRuntimeChatEvent(
      {
        sessionKey: "agent:a1:subagent:s1",
        state: "error",
        message: { role: "assistant", content: "Failed" },
      } as ChatEventPayload,
      subState
    );
    expect(subDeps.onActivityEvent).toHaveBeenCalledWith(
      "agent:a1:subagent:s1",
      expect.objectContaining({ status: "error" })
    );
  });

  describe("heartbeat routing", () => {
    it("routes heartbeat delta to activity throttle and returns", () => {
      handleRuntimeChatEvent(
        {
          sessionKey: "agent:agent-1:main",
          state: "delta",
          isHeartbeat: true,
          message: { role: "assistant", content: "checking..." },
        } as ChatEventPayload,
        state
      );
      // Delta heartbeats are throttled, no dispatch for appendPart
      expect(deps.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "appendPart" })
      );
    });

    it("routes heartbeat final HEARTBEAT_OK to idle", () => {
      handleRuntimeChatEvent(
        {
          sessionKey: "agent:agent-1:main",
          state: "final",
          isHeartbeat: true,
          runId: "run-hb",
          message: { role: "assistant", content: "HEARTBEAT_OK" },
        } as ChatEventPayload,
        state
      );
      expect(deps.onHeartbeatEvent).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ok", text: "HEARTBEAT_OK" })
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updateAgent",
          agentId: "agent-1",
          patch: expect.objectContaining({ status: "idle" }),
        })
      );
    });

    it("routes heartbeat final alert to activity message store (not main chat)", () => {
      deps.onActivityMessage = vi.fn();
      handleRuntimeChatEvent(
        {
          sessionKey: "agent:agent-1:main",
          state: "final",
          isHeartbeat: true,
          runId: "run-hb",
          message: { role: "assistant", content: "Alert: something wrong" },
        } as ChatEventPayload,
        state
      );
      expect(deps.onHeartbeatEvent).toHaveBeenCalledWith(
        expect.objectContaining({ status: "alert" })
      );
      // Non-OK heartbeats no longer pollute main chat — routed to activity
      expect(deps.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "appendPart" })
      );
      expect(deps.onActivityMessage).toHaveBeenCalledWith(
        "heartbeat-run-hb",
        expect.objectContaining({
          sourceName: "Heartbeat",
          sourceType: "heartbeat",
          status: "error",
        })
      );
    });
  });

  it("skips user and system role messages after summary patch", () => {
    handleRuntimeChatEvent(
      {
        sessionKey: "agent:agent-1:main",
        state: "final",
        message: { role: "user", content: "hello" },
      } as ChatEventPayload,
      state
    );
    // Should not dispatch appendPart for user messages
    expect(deps.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "appendPart" })
    );
  });

  describe("delta state", () => {
    it("queues live patch for text delta", () => {
      handleRuntimeChatEvent(
        {
          sessionKey: "agent:agent-1:main",
          state: "delta",
          message: { role: "assistant", content: "streaming text" },
        } as ChatEventPayload,
        state
      );
      expect(deps.queueLivePatch).toHaveBeenCalledWith(
        "agent-1",
        expect.objectContaining({ streamText: "streaming text", status: "running" })
      );
    });
  });

  describe("final state", () => {
    it("dispatches text and lastResult for assistant final", () => {
      handleRuntimeChatEvent(
        {
          sessionKey: "agent:agent-1:main",
          state: "final",
          runId: "run-1",
          message: { role: "assistant", content: "Done!" },
        } as ChatEventPayload,
        state
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "appendPart",
          agentId: "agent-1",
          part: expect.objectContaining({ type: "text", text: "Done!" }),
        })
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updateAgent",
          agentId: "agent-1",
          patch: expect.objectContaining({ status: "idle", runId: null }),
        })
      );
    });

    it("does not append text for tool role final", () => {
      handleRuntimeChatEvent(
        {
          sessionKey: "agent:agent-1:main",
          state: "final",
          runId: "run-1",
          message: { role: "tool", content: "tool result" },
        } as ChatEventPayload,
        state
      );
      expect(deps.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: "appendPart",
          part: expect.objectContaining({ type: "text" }),
        })
      );
    });
  });

  describe("aborted state", () => {
    it("dispatches abort text and sets idle", () => {
      handleRuntimeChatEvent(
        {
          sessionKey: "agent:agent-1:main",
          state: "aborted",
          runId: "run-1",
          message: { role: "assistant", content: "" },
        } as ChatEventPayload,
        state
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "appendPart",
          part: expect.objectContaining({ text: "Run aborted." }),
        })
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updateAgent",
          patch: expect.objectContaining({ status: "idle" }),
        })
      );
    });
  });

  describe("error state", () => {
    it("dispatches error text and sets error status", () => {
      handleRuntimeChatEvent(
        {
          sessionKey: "agent:agent-1:main",
          state: "error",
          runId: "run-1",
          errorMessage: "Something failed",
          message: null,
        } as ChatEventPayload,
        state
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "appendPart",
          part: expect.objectContaining({ text: "Error: Something failed" }),
        })
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updateAgent",
          patch: expect.objectContaining({ status: "error" }),
        })
      );
    });

    it("uses generic error text when no errorMessage", () => {
      handleRuntimeChatEvent(
        {
          sessionKey: "agent:agent-1:main",
          state: "error",
          runId: "run-1",
          message: null,
        } as ChatEventPayload,
        state
      );
      expect(deps.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "appendPart",
          part: expect.objectContaining({ text: "Run error." }),
        })
      );
    });
  });

  it("tracks runId in chatRunSeen", () => {
    handleRuntimeChatEvent(
      {
        sessionKey: "agent:agent-1:main",
        state: "delta",
        runId: "run-xyz",
        message: { role: "assistant", content: "hi" },
      } as ChatEventPayload,
      state
    );
    expect(state.chatRunSeen.has("run-xyz")).toBe(true);
  });
});
