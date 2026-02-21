import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useHeartbeatsPanel } from "@/features/agents/hooks/useHeartbeatsPanel";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

afterEach(cleanup);

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/gateway/GatewayClient", () => ({
  isGatewayDisconnectLikeError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/gateway/agentConfig", () => ({
  listHeartbeatsForAgent: vi.fn().mockResolvedValue({ heartbeats: [] }),
  removeGatewayHeartbeatOverride: vi.fn().mockResolvedValue({ ok: true }),
  triggerHeartbeatNow: vi.fn().mockResolvedValue({ ok: true }),
}));

const mocks = await import("@/lib/gateway/agentConfig");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(): GatewayClient {
  return { call: vi.fn().mockResolvedValue({ ok: true }) } as unknown as GatewayClient;
}

function makeHeartbeat(id = "hb-1") {
  return {
    id,
    agentId: "agent-1",
    source: "override" as const,
    enabled: true,
    heartbeat: { every: "5m", target: "main", includeReasoning: false },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useHeartbeatsPanel", () => {
  it("initializes with empty state", () => {
    const { result } = renderHook(() => useHeartbeatsPanel({ client: makeClient() }));
    expect(result.current.heartbeats).toEqual([]);
    expect(result.current.heartbeatLoading).toBe(false);
    expect(result.current.heartbeatError).toBeNull();
  });

  it("loads heartbeats for agent", async () => {
    const hb = makeHeartbeat();
    vi.mocked(mocks.listHeartbeatsForAgent).mockResolvedValueOnce({ heartbeats: [hb] });

    const { result } = renderHook(() => useHeartbeatsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.loadHeartbeats("agent-1");
    });

    expect(result.current.heartbeats).toHaveLength(1);
    expect(result.current.heartbeatLoading).toBe(false);
  });

  it("sets error on empty agent id", async () => {
    const { result } = renderHook(() => useHeartbeatsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.loadHeartbeats("  ");
    });

    expect(result.current.heartbeats).toEqual([]);
    expect(result.current.heartbeatError).toContain("missing agent id");
  });

  it("sets error when load fails", async () => {
    vi.mocked(mocks.listHeartbeatsForAgent).mockRejectedValueOnce(new Error("Timeout"));

    const { result } = renderHook(() => useHeartbeatsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.loadHeartbeats("agent-1");
    });

    expect(result.current.heartbeatError).toBe("Timeout");
    expect(result.current.heartbeats).toEqual([]);
  });

  it("triggers a heartbeat run", async () => {
    vi.mocked(mocks.listHeartbeatsForAgent).mockResolvedValue({ heartbeats: [] });

    const { result } = renderHook(() => useHeartbeatsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.handleRunHeartbeat("agent-1", "hb-1");
    });

    expect(mocks.triggerHeartbeatNow).toHaveBeenCalledWith(expect.anything(), "agent-1");
  });

  it("deletes a heartbeat", async () => {
    vi.mocked(mocks.listHeartbeatsForAgent).mockResolvedValue({ heartbeats: [] });

    const { result } = renderHook(() => useHeartbeatsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.handleDeleteHeartbeat("agent-1", "hb-1");
    });

    expect(mocks.removeGatewayHeartbeatOverride).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "agent-1" })
    );
  });

  it("guards against concurrent run and delete", async () => {
    let resolveRun: () => void;
    vi.mocked(mocks.triggerHeartbeatNow).mockImplementation(
      () => new Promise((resolve) => { resolveRun = () => resolve({ ok: true }); })
    );
    vi.mocked(mocks.listHeartbeatsForAgent).mockResolvedValue({ heartbeats: [] });
    vi.mocked(mocks.removeGatewayHeartbeatOverride).mockClear();

    const { result } = renderHook(() => useHeartbeatsPanel({ client: makeClient() }));

    let runPromise: Promise<void>;
    await act(async () => {
      runPromise = result.current.handleRunHeartbeat("agent-1", "hb-1");
    });

    expect(result.current.heartbeatRunBusyId).toBe("hb-1");

    // Delete should be blocked
    await act(async () => {
      await result.current.handleDeleteHeartbeat("agent-1", "hb-2");
    });
    expect(mocks.removeGatewayHeartbeatOverride).not.toHaveBeenCalled();

    await act(async () => {
      resolveRun!();
      await runPromise!;
    });
  });

  it("resets all state", async () => {
    vi.mocked(mocks.listHeartbeatsForAgent).mockResolvedValueOnce({
      heartbeats: [makeHeartbeat()],
    });

    const { result } = renderHook(() => useHeartbeatsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.loadHeartbeats("agent-1");
    });
    expect(result.current.heartbeats).toHaveLength(1);

    act(() => {
      result.current.resetHeartbeats();
    });

    expect(result.current.heartbeats).toEqual([]);
    expect(result.current.heartbeatLoading).toBe(false);
    expect(result.current.heartbeatError).toBeNull();
  });

  it("no-ops with empty ids", async () => {
    vi.mocked(mocks.triggerHeartbeatNow).mockClear();

    const { result } = renderHook(() => useHeartbeatsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.handleRunHeartbeat("", "hb-1");
    });
    expect(mocks.triggerHeartbeatNow).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleRunHeartbeat("agent-1", "  ");
    });
    expect(mocks.triggerHeartbeatNow).not.toHaveBeenCalled();
  });
});
