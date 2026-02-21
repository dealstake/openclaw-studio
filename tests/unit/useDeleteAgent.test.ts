import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeleteAgent } from "@/features/agents/hooks/useDeleteAgent";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

vi.mock("@/lib/gateway/agentConfig", () => ({
  deleteGatewayAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cron/types", () => ({
  removeCronJobsForAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/agents/operations/deleteAgentTransaction", () => ({
  runDeleteAgentTransaction: vi.fn(async (_deps: unknown, _agentId: string) => {}),
}));

vi.mock("@/lib/http", () => ({
  fetchJson: vi.fn().mockResolvedValue({ result: {} }),
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
    agents: [
      { agentId: "a1", name: "Agent One" },
      { agentId: "main", name: "Main Agent" },
    ] as never[],
    status: "connected",
    setError: vi.fn(),
    enqueueConfigMutation: vi.fn(async (p: { run: () => Promise<void> }) => {
      await p.run();
    }),
    loadAgents: vi.fn().mockResolvedValue(undefined),
    setSettingsAgentId: vi.fn(),
    setMobilePane: vi.fn(),
    isBusy: false,
    ...overrides,
  };
}

describe("useDeleteAgent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns expected API surface", () => {
    const { result } = renderHook(() => useDeleteAgent(makeParams()));
    expect(result.current.handleDeleteAgent).toBeTypeOf("function");
    expect(result.current.handleConfirmDeleteAgent).toBeTypeOf("function");
    expect(result.current.deleteAgentBlock).toBeNull();
    expect(result.current.deleteConfirmAgentId).toBeNull();
  });

  it("blocks deletion of main agent", () => {
    const setError = vi.fn();
    const { result } = renderHook(() => useDeleteAgent(makeParams({ setError })));
    act(() => {
      result.current.handleDeleteAgent("main");
    });
    expect(setError).toHaveBeenCalledWith("The main agent cannot be deleted.");
  });

  it("sets deleteConfirmAgentId for non-main agent", () => {
    const { result } = renderHook(() => useDeleteAgent(makeParams()));
    act(() => {
      result.current.handleDeleteAgent("a1");
    });
    expect(result.current.deleteConfirmAgentId).toBe("a1");
  });

  it("does nothing when isBusy", () => {
    const { result } = renderHook(() => useDeleteAgent(makeParams({ isBusy: true })));
    act(() => {
      result.current.handleDeleteAgent("a1");
    });
    expect(result.current.deleteConfirmAgentId).toBeNull();
  });

  it("ignores unknown agent", () => {
    const { result } = renderHook(() => useDeleteAgent(makeParams()));
    act(() => {
      result.current.handleDeleteAgent("unknown");
    });
    expect(result.current.deleteConfirmAgentId).toBeNull();
  });
});
