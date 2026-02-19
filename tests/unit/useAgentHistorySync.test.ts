import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAgentHistorySync } from "@/features/agents/hooks/useAgentHistorySync";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { AgentState } from "@/features/agents/state/store";
import { createRef } from "react";

afterEach(cleanup);

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/features/agents/state/runtimeEventBridge", () => ({
  buildHistorySyncPatch: vi.fn().mockReturnValue({ historyLoadedAt: 1000, outputLines: [] }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<GatewayClient> = {}): GatewayClient {
  return {
    call: vi.fn().mockResolvedValue({ messages: [] }),
    status: "connected",
    ...overrides,
  } as unknown as GatewayClient;
}

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    agentId: "agent-1",
    agentName: "Test Agent",
    sessionKey: "session-1",
    sessionCreated: true,
    historyLoadedAt: null,
    outputLines: [],
  messageParts: [],
    status: "idle",
    runId: null,
    ...overrides,
  } as AgentState;
}

function makeStateRef(agents: AgentState[]) {
  const ref = createRef<{ agents: AgentState[] }>();
  // createRef returns readonly — use Object.defineProperty to set current
  Object.defineProperty(ref, "current", { value: { agents }, writable: true });
  return ref as React.RefObject<{ agents: AgentState[] }>;
}

function defaultParams(overrides: Partial<Parameters<typeof useAgentHistorySync>[0]> = {}) {
  const agents = overrides.agents ?? [makeAgent()];
  return {
    client: makeClient(),
    dispatch: vi.fn(),
    agents,
    stateRef: makeStateRef(agents),
    status: "connected",
    focusedAgentId: null,
    focusedAgentRunning: false,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useAgentHistorySync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads history for agents without historyLoadedAt on mount", async () => {
    const agent = makeAgent({ historyLoadedAt: null });
    const client = makeClient();
    const dispatch = vi.fn();
    const params = defaultParams({ agents: [agent], client, dispatch });

    renderHook(() => useAgentHistorySync(params));
    await act(async () => {});

    expect(client.call).toHaveBeenCalledWith("chat.history", {
      sessionKey: "session-1",
      limit: 200,
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "updateAgent", agentId: "agent-1" })
    );
  });

  it("skips agents that already have historyLoadedAt", async () => {
    const agent = makeAgent({ historyLoadedAt: 999 });
    const client = makeClient();
    const params = defaultParams({ agents: [agent], client });

    renderHook(() => useAgentHistorySync(params));
    await act(async () => {});

    expect(client.call).not.toHaveBeenCalled();
  });

  it("skips agents without sessionCreated", async () => {
    const agent = makeAgent({ sessionCreated: false, historyLoadedAt: null });
    const client = makeClient();
    const params = defaultParams({ agents: [agent], client });

    renderHook(() => useAgentHistorySync(params));
    await act(async () => {});

    expect(client.call).not.toHaveBeenCalled();
  });

  it("does not load history when disconnected", async () => {
    const agent = makeAgent({ historyLoadedAt: null });
    const client = makeClient();
    const params = defaultParams({ agents: [agent], client, status: "disconnected" });

    renderHook(() => useAgentHistorySync(params));
    await act(async () => {});

    expect(client.call).not.toHaveBeenCalled();
  });

  it("polls history for running focused agent", async () => {
    const agent = makeAgent({ status: "running", historyLoadedAt: null });
    const client = makeClient();
    const dispatch = vi.fn();
    const stateRef = makeStateRef([agent]);
    const params = defaultParams({
      agents: [agent],
      client,
      dispatch,
      stateRef,
      focusedAgentId: "agent-1",
      focusedAgentRunning: true,
    });

    renderHook(() => useAgentHistorySync(params));
    await act(async () => {});

    // Initial load fires immediately
    expect(client.call).toHaveBeenCalled();
    const callCount = (client.call as ReturnType<typeof vi.fn>).mock.calls.length;

    // Advance 5 seconds for one poll tick
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect((client.call as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callCount);
  });

  it("caps polling at 60 iterations", async () => {
    const agent = makeAgent({ status: "running", historyLoadedAt: null });
    const client = makeClient();
    const stateRef = makeStateRef([agent]);
    const params = defaultParams({
      agents: [agent],
      client,
      stateRef,
      focusedAgentId: "agent-1",
      focusedAgentRunning: true,
    });

    renderHook(() => useAgentHistorySync(params));
    await act(async () => {});

    // Advance past 60 poll intervals (5s * 65 = 325s)
    for (let i = 0; i < 65; i++) {
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
    }

    // Should be capped — not more than ~62 calls (initial + effects + 60 polls)
    const totalCalls = (client.call as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(totalCalls).toBeLessThanOrEqual(65);
  });

  it("handles API errors gracefully", async () => {
    const agent = makeAgent({ historyLoadedAt: null });
    const client = makeClient({
      call: vi.fn().mockRejectedValue(new Error("network error")),
    });
    const dispatch = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const params = defaultParams({ agents: [agent], client, dispatch });
    renderHook(() => useAgentHistorySync(params));
    await act(async () => {});

    expect(dispatch).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("prevents duplicate in-flight requests for same session", async () => {
    let resolveCall: () => void;
    const slowCall = vi.fn().mockImplementation(
      () => new Promise<{ messages: never[] }>((resolve) => {
        resolveCall = () => resolve({ messages: [] });
      })
    );
    const agent = makeAgent({ historyLoadedAt: null });
    const client = makeClient({ call: slowCall });
    const params = defaultParams({ agents: [agent], client });

    const { result } = renderHook(() => useAgentHistorySync(params));
    await act(async () => {});

    // First call is in-flight
    expect(slowCall).toHaveBeenCalledTimes(1);

    // Try loading again — should be deduped
    await act(async () => {
      result.current.loadAgentHistory("agent-1");
    });
    // Still only 1 call (the second was deduped via historyInFlightRef)
    expect(slowCall).toHaveBeenCalledTimes(1);

    // Resolve the first call
    await act(async () => {
      resolveCall!();
    });
  });
});
