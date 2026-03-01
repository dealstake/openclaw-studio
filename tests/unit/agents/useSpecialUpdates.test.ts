import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpecialUpdates } from "@/features/agents/hooks/useSpecialUpdates";
import type { AgentState } from "@/features/agents/state/store";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const makeAgent = (overrides: Partial<AgentState> = {}): AgentState => ({
  agentId: "alex",
  name: "Alex",
  sessionKey: "agent:alex:main",
  status: "idle",
  runId: null, runStartedAt: null,
  streamText: null,
  thinkingTrace: null,
  lastResult: null,
  lastDiff: null,
  lastUserMessage: null,
  lastActivityAt: null,
  lastAssistantMessageAt: null,
  sessionCreated: false,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  toolCallingEnabled: true,
  showThinkingTraces: true,
  autonomyLevel: "autonomous",
  wizardContext: null,
  messageParts: [],
  latestOverride: null,
  latestOverrideKind: null,
  latestPreview: null,
  draft: "",
  sessionSettingsSynced: false,
  historyLoadedAt: null,
  ...overrides,
});

const makeClient = () => ({
  call: vi.fn().mockResolvedValue({ sessions: [] }),
  on: vi.fn(),
  off: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  isConnected: vi.fn(() => true),
});

const makeDispatch = () => vi.fn();

const makeParams = (agentOverrides: Partial<AgentState> = {}) => {
  const agents = [makeAgent(agentOverrides)];
  const stateRef = { current: { agents } };
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: makeClient() as any,
    dispatch: makeDispatch(),
    agents,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stateRef: stateRef as any,
  };
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("useSpecialUpdates", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns expected shape", () => {
    const params = makeParams();
    const { result } = renderHook(() => useSpecialUpdates(params));
    expect(result.current).toHaveProperty("heartbeatTick");
    expect(result.current).toHaveProperty("updateSpecialLatestUpdate");
    expect(result.current).toHaveProperty("refreshHeartbeatLatestUpdate");
    expect(result.current).toHaveProperty("bumpHeartbeatTick");
    expect(typeof result.current.bumpHeartbeatTick).toBe("function");
  });

  it("bumpHeartbeatTick increments tick", () => {
    const params = makeParams();
    const { result } = renderHook(() => useSpecialUpdates(params));
    expect(result.current.heartbeatTick).toBe(0);
    act(() => result.current.bumpHeartbeatTick());
    expect(result.current.heartbeatTick).toBe(1);
  });

  it("clears latestOverride for non-special messages", async () => {
    const params = makeParams({ latestOverride: "old", latestOverrideKind: "cron" });
    const { result } = renderHook(() => useSpecialUpdates(params));

    await act(async () => {
      await result.current.updateSpecialLatestUpdate("alex", params.agents[0], "normal message");
    });

    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "updateAgent",
        agentId: "alex",
        patch: { latestOverride: null, latestOverrideKind: null },
      })
    );
  });

  it("does not clear latestOverride if already null", async () => {
    const params = makeParams({ latestOverride: null, latestOverrideKind: null });
    const { result } = renderHook(() => useSpecialUpdates(params));

    await act(async () => {
      await result.current.updateSpecialLatestUpdate("alex", params.agents[0], "normal message");
    });

    expect(params.dispatch).not.toHaveBeenCalled();
  });

  it("resolves heartbeat kind and fetches sessions + history", async () => {
    const params = makeParams();
    // Default mock returns empty sessions — let useEffect settle first
    const { result } = renderHook(() => useSpecialUpdates(params));

    // Now reset and set up the heartbeat mocks for direct call
    params.client.call.mockReset();
    params.dispatch.mockClear();
    params.client.call
      .mockResolvedValueOnce({
        sessions: [
          { key: "agent:alex:heartbeat:1", updatedAt: 1000, origin: { label: "Heartbeat" } },
        ],
      })
      .mockResolvedValueOnce({
        messages: [
          { role: "user", content: "Read HEARTBEAT.md if it exists and act on it" },
          { role: "assistant", content: "HEARTBEAT_OK" },
        ],
      });

    await act(async () => {
      await result.current.updateSpecialLatestUpdate("alex", params.agents[0], "heartbeat check");
    });

    expect(params.client.call).toHaveBeenCalledWith("sessions.list", expect.objectContaining({ agentId: "alex" }));
    expect(params.client.call).toHaveBeenCalledWith("chat.history", expect.objectContaining({ sessionKey: "agent:alex:heartbeat:1" }));
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ latestOverrideKind: "heartbeat" }),
      })
    );
  });

  it("resolves cron kind and fetches cron jobs", async () => {
    const params = makeParams();
    params.client.call.mockResolvedValueOnce({
      jobs: [
        {
          id: "job-1",
          name: "Test Cron",
          agentId: "alex",
          enabled: true,
          schedule: { kind: "every", everyMs: 300000 },
          payload: { kind: "agentTurn", message: "do stuff" },
          state: {},
        },
      ],
    });

    const { result } = renderHook(() => useSpecialUpdates(params));

    await act(async () => {
      await result.current.updateSpecialLatestUpdate("alex", params.agents[0], "cron task update");
    });

    expect(params.client.call).toHaveBeenCalledWith("cron.list", expect.anything());
  });

  it("deduplicates in-flight requests for same agent", async () => {
    const params = makeParams();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveFirst!: (v: any) => void;
    params.client.call.mockReturnValueOnce(
      new Promise((r) => { resolveFirst = r; })
    );

    const { result } = renderHook(() => useSpecialUpdates(params));

    // Fire two concurrent calls
    let p1: Promise<void>, p2: Promise<void>;
    await act(async () => {
      p1 = result.current.updateSpecialLatestUpdate("alex", params.agents[0], "heartbeat a");
      p2 = result.current.updateSpecialLatestUpdate("alex", params.agents[0], "heartbeat b");
    });

    // Only one RPC should have been made (second was deduped)
    expect(params.client.call).toHaveBeenCalledTimes(1);

    // Resolve to clean up
    resolveFirst({ sessions: [] });
    await act(async () => { await p1!; await p2!; });
  });

  it("handles RPC errors gracefully", async () => {
    const params = makeParams();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    params.client.call.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useSpecialUpdates(params));

    await act(async () => {
      await result.current.updateSpecialLatestUpdate("alex", params.agents[0], "heartbeat check");
    });

    // Should not throw, should log error
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("clears latestOverride when heartbeat returns no sessions", async () => {
    const params = makeParams();
    params.client.call.mockResolvedValueOnce({ sessions: [] });

    const { result } = renderHook(() => useSpecialUpdates(params));

    await act(async () => {
      await result.current.updateSpecialLatestUpdate("alex", params.agents[0], "heartbeat check");
    });

    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: { latestOverride: null, latestOverrideKind: null },
      })
    );
  });

  it("refreshHeartbeatLatestUpdate triggers update for all agents", async () => {
    const params = makeParams();
    params.client.call.mockResolvedValue({ sessions: [] });

    const { result } = renderHook(() => useSpecialUpdates(params));

    await act(async () => {
      result.current.refreshHeartbeatLatestUpdate();
    });

    // Should have called sessions.list for the agent
    expect(params.client.call).toHaveBeenCalledWith("sessions.list", expect.anything());
  });

  it("prioritizes based on which keyword appears later in message", async () => {
    const params = makeParams();
    // resolveSpecialUpdateKind: if cronIndex > heartbeatIndex → "cron", else "heartbeat"
    // In "heartbeat then cron": heartbeat at 0, cron at 15 → cronIndex > heartbeatIndex → "cron"
    params.client.call.mockResolvedValueOnce({ jobs: [] });

    const { result } = renderHook(() => useSpecialUpdates(params));

    await act(async () => {
      await result.current.updateSpecialLatestUpdate("alex", params.agents[0], "heartbeat then cron");
    });

    expect(params.client.call).toHaveBeenCalledWith("cron.list", expect.anything());
  });
});
