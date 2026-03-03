import { PERSONA_DEFAULTS } from "../helpers/agentFixtures";
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useChatCallbacks } from "@/features/agents/hooks/useChatCallbacks";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { AgentState } from "@/features/agents/state/store";

// Mock syncGatewaySessionSettings
vi.mock("@/lib/gateway/GatewayClient", async () => {
  const actual = await vi.importActual("@/lib/gateway/GatewayClient");
  return {
    ...actual,
    syncGatewaySessionSettings: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/text/message-extract", () => ({
  buildAgentInstruction: ({ message }: { message: string }) => message,
}));

vi.mock("@/features/agents/state/store", async () => {
  const actual = await vi.importActual("@/features/agents/state/store");
  return {
    ...actual,
    buildNewSessionAgentPatch: () => ({ messageParts: [], status: "idle", runId: null }),
  };
});

vi.mock("@/features/agents/state/sessionSettingsMutations", () => ({
  applySessionSettingMutation: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    agentId: "agent-1",
    name: "Test Agent",
    sessionKey: "agent:agent-1:studio:test",
    status: "idle",
    sessionCreated: true,
    awaitingUserInput: false,
    hasUnseenActivity: false,
    messageParts: [],
    lastResult: null,
    lastDiff: null,
    runId: null, runStartedAt: null,
    streamText: null,
    thinkingTrace: null,
    latestOverride: null,
    latestOverrideKind: null,
    lastAssistantMessageAt: null,
    lastActivityAt: null,
    latestPreview: null,
    lastUserMessage: null,
    draft: "",
    sessionSettingsSynced: true,
    historyLoadedAt: null,
    toolCallingEnabled: true,
    showThinkingTraces: true,
  autonomyLevel: "autonomous",
  wizardContext: null,
    model: "openai/gpt-5",
    thinkingLevel: "medium",
    avatarSeed: "seed-1",
    avatarUrl: null,
    group: null,
    tags: [],
  ...PERSONA_DEFAULTS,
    ...overrides,
  };
}

function makeClient(): GatewayClient {
  return {
    call: vi.fn().mockResolvedValue({ ok: true }),
    status: "connected",
  } as unknown as GatewayClient;
}

function makeParams(overrides: Record<string, unknown> = {}) {
  const agents = [makeAgent()];
  return {
    client: makeClient(),
    status: "connected",
    agents,
    dispatch: vi.fn(),
    stateRef: { current: { agents } },
    runtimeEventHandlerRef: { current: { clearRunTracking: vi.fn(), handleEvent: vi.fn(), dispose: vi.fn() } },
    historyInFlightRef: { current: new Set<string>() },
    specialUpdateRef: { current: new Map<string, string>() },
    specialUpdateInFlightRef: { current: new Set<string>() },
    pendingDraftTimersRef: { current: new Map<string, number>() },
    pendingDraftValuesRef: { current: new Map<string, string>() },
    setError: vi.fn(),
    setSettingsAgentId: vi.fn(),
    setMobilePane: vi.fn(),
    stopBusyAgentId: null,
    setStopBusyAgentId: vi.fn(),
    ...overrides,
  } as Parameters<typeof useChatCallbacks>[0];
}

describe("useChatCallbacks", () => {
  describe("handleNewSession", () => {
    it("calls sessions.reset and dispatches updateAgent", async () => {
      const params = makeParams();
      const { result } = renderHook(() => useChatCallbacks(params));

      await act(async () => {
        await result.current.handleNewSession("agent-1");
      });

      expect(params.client.call).toHaveBeenCalledWith("sessions.reset", {
        key: "agent:agent-1:studio:test",
      });
      expect(params.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "updateAgent", agentId: "agent-1" })
      );
    });

    it("sets error when agent not found", async () => {
      const params = makeParams();
      const { result } = renderHook(() => useChatCallbacks(params));

      await act(async () => {
        await result.current.handleNewSession("nonexistent");
      });

      expect(params.setError).toHaveBeenCalledWith(
        "Failed to start new session: agent not found."
      );
    });
  });

  describe("handleSend", () => {
    it("dispatches running state and calls chat.send", async () => {
      const params = makeParams();
      const { result } = renderHook(() => useChatCallbacks(params));

      await act(async () => {
        await result.current.handleSend("agent-1", "agent:agent-1:studio:test", "Hello");
      });

      expect(params.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "updateAgent", agentId: "agent-1", patch: expect.objectContaining({ status: "running" }) })
      );
      expect(params.client.call).toHaveBeenCalledWith(
        "chat.send",
        expect.objectContaining({ sessionKey: "agent:agent-1:studio:test", deliver: false })
      );
    });

    it("ignores empty messages", async () => {
      const params = makeParams();
      const { result } = renderHook(() => useChatCallbacks(params));

      await act(async () => {
        await result.current.handleSend("agent-1", "key", "   ");
      });

      expect(params.client.call).not.toHaveBeenCalled();
    });

    it("handles send error gracefully", async () => {
      const params = makeParams();
      (params.client.call as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
      const { result } = renderHook(() => useChatCallbacks(params));

      await act(async () => {
        await result.current.handleSend("agent-1", "agent:agent-1:studio:test", "Hello");
      });

      expect(params.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updateAgent",
          patch: expect.objectContaining({ status: "error" }),
        })
      );
    });
  });

  describe("handleStopRun", () => {
    it("calls chat.abort", async () => {
      const params = makeParams();
      const { result } = renderHook(() => useChatCallbacks(params));

      await act(async () => {
        await result.current.handleStopRun("agent-1", "agent:agent-1:studio:test");
      });

      expect(params.client.call).toHaveBeenCalledWith("chat.abort", {
        sessionKey: "agent:agent-1:studio:test",
      });
    });

    it("sets error when not connected", async () => {
      const params = makeParams({ status: "disconnected" });
      const { result } = renderHook(() => useChatCallbacks(params));

      await act(async () => {
        await result.current.handleStopRun("agent-1", "key");
      });

      expect(params.setError).toHaveBeenCalledWith(
        "Connect to gateway before stopping a run."
      );
    });
  });

  describe("handleToolCallingToggle", () => {
    it("dispatches toolCallingEnabled patch", () => {
      const params = makeParams();
      const { result } = renderHook(() => useChatCallbacks(params));

      act(() => {
        result.current.handleToolCallingToggle("agent-1", false);
      });

      expect(params.dispatch).toHaveBeenCalledWith({
        type: "updateAgent",
        agentId: "agent-1",
        patch: { toolCallingEnabled: false },
      });
    });
  });

  describe("handleThinkingTracesToggle", () => {
    it("dispatches showThinkingTraces patch", () => {
      const params = makeParams();
      const { result } = renderHook(() => useChatCallbacks(params));

      act(() => {
        result.current.handleThinkingTracesToggle("agent-1", true);
      });

      expect(params.dispatch).toHaveBeenCalledWith({
        type: "updateAgent",
        agentId: "agent-1",
        patch: { showThinkingTraces: true },
      });
    });
  });
});
