import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRenameAgent } from "@/features/agents/hooks/useRenameAgent";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

vi.mock("@/lib/gateway/agentConfig", () => ({
  renameGatewayAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/agents/hooks/useRestartAwaitEffect", () => ({
  useRestartAwaitEffect: vi.fn(),
}));

function makeClient(): GatewayClient {
  return { call: vi.fn() } as unknown as GatewayClient;
}

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    client: makeClient(),
    dispatch: vi.fn(),
    agents: [
      { agentId: "a1", name: "Agent One", sessionKey: "sk1" },
      { agentId: "a2", name: "Agent Two", sessionKey: "sk2" },
    ] as never[],
    status: "connected",
    setError: vi.fn(),
    enqueueConfigMutation: vi.fn(async (p: { run: () => Promise<void> }) => {
      await p.run();
    }),
    loadAgents: vi.fn().mockResolvedValue(undefined),
    setMobilePane: vi.fn(),
    isBusy: false,
    ...overrides,
  };
}

describe("useRenameAgent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns handleRenameAgent and renameAgentBlock", () => {
    const { result } = renderHook(() => useRenameAgent(makeParams()));
    expect(result.current.handleRenameAgent).toBeTypeOf("function");
    expect(result.current.renameAgentBlock).toBeNull();
  });

  it("returns false when agent not found", async () => {
    const { result } = renderHook(() => useRenameAgent(makeParams()));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleRenameAgent("nonexistent", "New Name");
    });
    expect(ok).toBe(false);
  });

  it("returns false when isBusy", async () => {
    const { result } = renderHook(() => useRenameAgent(makeParams({ isBusy: true })));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleRenameAgent("a1", "New Name");
    });
    expect(ok).toBe(false);
  });

  it("renames agent successfully", async () => {
    const dispatch = vi.fn();
    const params = makeParams({ dispatch });
    const { result } = renderHook(() => useRenameAgent(params));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleRenameAgent("a1", "Renamed");
    });
    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({
      type: "updateAgent",
      agentId: "a1",
      patch: { name: "Renamed" },
    });
  });

  it("sets error on failure", async () => {
    const setError = vi.fn();
    const params = makeParams({
      setError,
      enqueueConfigMutation: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const { result } = renderHook(() => useRenameAgent(params));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.handleRenameAgent("a1", "Renamed");
    });
    expect(ok).toBe(false);
    expect(setError).toHaveBeenCalledWith("boom");
  });
});
