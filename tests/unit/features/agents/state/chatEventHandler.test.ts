import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRuntimeChatEvent } from "@/features/agents/state/chatEventHandler";
import { RuntimeTrackingState } from "@/features/agents/state/runtimeTrackingState";
import type { GatewayRuntimeEventHandlerDeps, RuntimeDispatchAction } from "@/features/agents/state/gatewayRuntimeEventHandler.types";
import type { ChatEventPayload } from "@/features/agents/state/runtimeEventBridge.types";
import type { AgentState } from "@/features/agents/state/store";
import { PERSONA_DEFAULTS } from "../../../../helpers/agentFixtures";

// ── Test Helpers ─────────────────────────────────────────────────────

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    agentId: "agent-1",
    name: "Test Agent",
    sessionKey: "main:session:agent-1",
    avatarSeed: null,
    avatarUrl: null,
    status: "idle",
    sessionCreated: true,
    awaitingUserInput: false,
    hasUnseenActivity: false,
    messageParts: [],
    lastResult: null,
    lastDiff: null,
    runId: null,
    runStartedAt: null,
    streamText: null,
    thinkingTrace: null,
    latestOverride: null,
    latestOverrideKind: null,
    lastAssistantMessageAt: null,
    lastActivityAt: null,
    latestPreview: null,
    lastUserMessage: null,
    draft: "",
    sessionSettingsSynced: false,
    historyLoadedAt: null,
    toolCallingEnabled: true,
    showThinkingTraces: false,
  autonomyLevel: "autonomous",
    wizardContext: null,
    group: null,
    tags: [],
  ...PERSONA_DEFAULTS,
    ...overrides,
  };
}

function makeDeps(agents: AgentState[] = []): GatewayRuntimeEventHandlerDeps & {
  dispatched: RuntimeDispatchAction[];
  livePatches: Array<{ agentId: string; patch: Partial<AgentState> }>;
  clearedPatches: string[];
} {
  const dispatched: RuntimeDispatchAction[] = [];
  const livePatches: Array<{ agentId: string; patch: Partial<AgentState> }> = [];
  const clearedPatches: string[] = [];

  return {
    dispatched,
    livePatches,
    clearedPatches,
    getStatus: () => "connected",
    getAgents: () => agents,
    dispatch: (action) => dispatched.push(action),
    queueLivePatch: (agentId, patch) => livePatches.push({ agentId, patch }),
    clearPendingLivePatch: (agentId) => clearedPatches.push(agentId),
    now: () => 1000000,
    loadSummarySnapshot: vi.fn().mockResolvedValue(undefined),
    loadAgentHistory: vi.fn().mockResolvedValue(undefined),
    refreshHeartbeatLatestUpdate: vi.fn(),
    bumpHeartbeatTick: vi.fn(),
    setTimeout: vi.fn().mockReturnValue(1),
    clearTimeout: vi.fn(),
    isDisconnectLikeError: () => false,
    logWarn: vi.fn(),
    updateSpecialLatestUpdate: vi.fn(),
    onActivityMessage: vi.fn(),
  };
}

function makePayload(overrides: Partial<ChatEventPayload> = {}): ChatEventPayload {
  return {
    runId: "run-1",
    sessionKey: "main:session:agent-1",
    state: "delta",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("chatEventHandler", () => {
  describe("handleRuntimeChatEvent — routing", () => {
    it("ignores events with no sessionKey", () => {
      const deps = makeDeps();
      const state = new RuntimeTrackingState(deps);
      handleRuntimeChatEvent({ runId: "r1", sessionKey: "", state: "delta" } as ChatEventPayload, state);
      // sessionKey is falsy → early return, no dispatches
      expect(deps.dispatched).toHaveLength(0);
    });

    it("routes cron session events to activity feed", () => {
      const deps = makeDeps();
      const state = new RuntimeTrackingState(deps);
      const payload = makePayload({
        sessionKey: "main:cron:some-job",
        state: "final",
        message: { role: "assistant", content: "Done" },
      });
      handleRuntimeChatEvent(payload, state);
      expect(deps.onActivityMessage).toHaveBeenCalledWith(
        "main:cron:some-job",
        expect.objectContaining({ sourceType: "cron", status: "complete" })
      );
      // No agent dispatches
      expect(deps.dispatched).toHaveLength(0);
    });

    it("routes subagent session events to activity feed", () => {
      const deps = makeDeps();
      const state = new RuntimeTrackingState(deps);
      const payload = makePayload({
        sessionKey: "main:subagent:task-1",
        state: "delta",
        message: { role: "assistant", content: "Working..." },
      });
      handleRuntimeChatEvent(payload, state);
      expect(deps.onActivityMessage).toHaveBeenCalledWith(
        "main:subagent:task-1",
        expect.objectContaining({ sourceType: "subagent", status: "streaming" })
      );
    });

    it("skips user/system role messages after summary patch", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);
      handleRuntimeChatEvent(
        makePayload({ state: "final", message: { role: "user", content: "hi" } }),
        state
      );
      // Should get summary patch but no stream/part dispatches
      const hasStreamOrPart = deps.dispatched.some(
        (a) => a.type === "appendPart" || (a.type === "updateAgent" && "streamText" in (a.patch ?? {}))
      );
      expect(hasStreamOrPart).toBe(false);
    });
  });

  describe("handleHeartbeatEvent", () => {
    it("marks agent in heartbeat mode on delta", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);
      handleRuntimeChatEvent(
        makePayload({ isHeartbeat: true, state: "delta" }),
        state
      );
      expect(state.heartbeatActiveAgents.has("agent-1")).toBe(true);
    });

    it("clears heartbeat mode on final and dispatches idle", () => {
      const agent = makeAgent({ status: "running" });
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);
      // Set heartbeat active first
      state.heartbeatActiveAgents.add("agent-1");

      handleRuntimeChatEvent(
        makePayload({
          isHeartbeat: true,
          state: "final",
          message: { role: "assistant", content: "HEARTBEAT_OK" },
        }),
        state
      );
      expect(state.heartbeatActiveAgents.has("agent-1")).toBe(false);
      const idlePatch = deps.dispatched.find(
        (a) => a.type === "updateAgent" && a.patch.status === "idle"
      );
      expect(idlePatch).toBeDefined();
    });

    it("sends heartbeat result to activity feed", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);
      handleRuntimeChatEvent(
        makePayload({
          isHeartbeat: true,
          state: "final",
          message: { role: "assistant", content: "HEARTBEAT_OK" },
        }),
        state
      );
      expect(deps.onActivityMessage).toHaveBeenCalledWith(
        expect.stringContaining("heartbeat-"),
        expect.objectContaining({
          sourceType: "heartbeat",
          status: "complete",
        })
      );
    });

    it("suppresses non-heartbeat events while heartbeat is active", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);
      state.heartbeatActiveAgents.add("agent-1");

      handleRuntimeChatEvent(
        makePayload({ state: "delta", message: { role: "assistant", content: "text" } }),
        state
      );
      // No live patches queued — event was suppressed
      expect(deps.livePatches).toHaveLength(0);
    });
  });

  describe("handleDeltaEvent", () => {
    it("queues live patch with streaming text", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "delta",
          message: { role: "assistant", content: "Hello streaming" },
        }),
        state
      );
      expect(deps.livePatches).toHaveLength(1);
      expect(deps.livePatches[0].patch.streamText).toBe("Hello streaming");
      expect(deps.livePatches[0].patch.status).toBe("running");
    });

    it("sets runStartedAt when transitioning to running", () => {
      const agent = makeAgent({ status: "idle" });
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "delta",
          message: { role: "assistant", content: "Starting" },
        }),
        state
      );
      expect(deps.livePatches[0].patch.runStartedAt).toBe(1000000);
    });

    it("does not reset runStartedAt if already running", () => {
      const agent = makeAgent({ status: "running" });
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "delta",
          message: { role: "assistant", content: "Still going" },
        }),
        state
      );
      expect(deps.livePatches[0].patch.runStartedAt).toBeUndefined();
    });

    it("appends text part to messageParts tracking", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "delta",
          message: { role: "assistant", content: "Chunk" },
        }),
        state
      );
      const appendPart = deps.dispatched.find((a) => a.type === "appendPart");
      expect(appendPart).toBeDefined();
      if (appendPart?.type === "appendPart") {
        expect(appendPart.part.type).toBe("text");
        expect("streaming" in appendPart.part && appendPart.part.streaming).toBe(true);
      }
    });
  });

  describe("handleFinalEvent", () => {
    it("dispatches idle status and clears stream state", () => {
      const agent = makeAgent({ status: "running", streamText: "partial" });
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "final",
          message: { role: "assistant", content: "Complete response" },
        }),
        state
      );
      const idlePatch = deps.dispatched.find(
        (a) => a.type === "updateAgent" && a.patch.status === "idle"
      );
      expect(idlePatch).toBeDefined();
      if (idlePatch?.type === "updateAgent") {
        expect(idlePatch.patch.streamText).toBeNull();
        expect(idlePatch.patch.thinkingTrace).toBeNull();
        expect(idlePatch.patch.runId).toBeNull();
      }
    });

    it("dispatches lastResult for assistant text", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "final",
          message: { role: "assistant", content: "Final answer" },
        }),
        state
      );
      const lastResultPatch = deps.dispatched.find(
        (a) => a.type === "updateAgent" && a.patch.lastResult !== undefined
      );
      expect(lastResultPatch).toBeDefined();
      if (lastResultPatch?.type === "updateAgent") {
        expect(lastResultPatch.patch.lastResult).toBe("Final answer");
      }
    });

    it("clears pending live patch on final", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "final",
          message: { role: "assistant", content: "Done" },
        }),
        state
      );
      expect(deps.clearedPatches).toContain("agent-1");
    });

    it("loads history when no thinking trace found", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "final",
          message: { role: "assistant", content: "No thinking" },
        }),
        state
      );
      expect(deps.loadAgentHistory).toHaveBeenCalledWith("agent-1");
    });

    it("does not dispatch lastResult for tool role messages", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "final",
          message: { role: "tool", content: "tool output" },
        }),
        state
      );
      const lastResultPatch = deps.dispatched.find(
        (a) => a.type === "updateAgent" && a.patch.lastResult !== undefined
      );
      expect(lastResultPatch).toBeUndefined();
    });
  });

  describe("handleAbortedEvent", () => {
    it("dispatches error status part and resets to idle", () => {
      const agent = makeAgent({ status: "running" });
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "aborted",
          errorMessage: "User cancelled",
        }),
        state
      );
      const errorPart = deps.dispatched.find(
        (a) => a.type === "appendPart" && a.part.type === "status"
      );
      expect(errorPart).toBeDefined();
      if (errorPart?.type === "appendPart") {
        expect(errorPart.part.type).toBe("status");
      }
      const idlePatch = deps.dispatched.find(
        (a) => a.type === "updateAgent" && a.patch.status === "idle"
      );
      expect(idlePatch).toBeDefined();
    });

    it("uses default message when errorMessage is missing", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(makePayload({ state: "aborted" }), state);
      const errorPart = deps.dispatched.find(
        (a) => a.type === "appendPart" && a.part.type === "status"
      );
      expect(errorPart).toBeDefined();
    });
  });

  describe("handleErrorEvent", () => {
    it("dispatches error status part and sets error state", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({
          state: "error",
          errorMessage: "Rate limit exceeded",
        }),
        state
      );
      const errorPart = deps.dispatched.find(
        (a) => a.type === "appendPart" && a.part.type === "status"
      );
      expect(errorPart).toBeDefined();
      const errorStatus = deps.dispatched.find(
        (a) => a.type === "updateAgent" && a.patch.status === "error"
      );
      expect(errorStatus).toBeDefined();
    });

    it("clears run tracking and pending patches on error", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);
      state.chatRunSeen.add("run-1");

      handleRuntimeChatEvent(
        makePayload({ state: "error", errorMessage: "fail" }),
        state
      );
      expect(state.chatRunSeen.has("run-1")).toBe(false);
      expect(deps.clearedPatches).toContain("agent-1");
    });
  });

  describe("run tracking", () => {
    it("adds runId to chatRunSeen on any event", () => {
      const agent = makeAgent();
      const deps = makeDeps([agent]);
      const state = new RuntimeTrackingState(deps);

      handleRuntimeChatEvent(
        makePayload({ runId: "run-xyz", state: "delta", message: { role: "assistant", content: "x" } }),
        state
      );
      expect(state.chatRunSeen.has("run-xyz")).toBe(true);
    });
  });
});
