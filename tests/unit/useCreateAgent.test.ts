import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCreateAgent } from "@/features/agents/hooks/useCreateAgent";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

vi.mock("@/lib/gateway/agentConfig", () => ({
  createGatewayAgent: vi.fn().mockResolvedValue({ id: "new-agent-1" }),
}));

vi.mock("@/lib/gateway/agentFiles", () => ({
  bootstrapAgentBrainFilesFromTemplate: vi.fn().mockResolvedValue(undefined),
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
    stateRef: { current: { agents: [] } } as React.RefObject<{ agents: never[] }>,
    status: "connected",
    setError: vi.fn(),
    enqueueConfigMutation: vi.fn(async (p: { run: () => Promise<void> }) => {
      await p.run();
    }),
    loadAgents: vi.fn().mockResolvedValue(undefined),
    flushPendingDraft: vi.fn(),
    focusedAgentId: "existing-1",
    setFocusFilter: vi.fn(),
    focusFilterTouchedRef: { current: false } as React.RefObject<boolean>,
    setSettingsAgentId: vi.fn(),
    setMobilePane: vi.fn(),
    isBusy: false,
    ...overrides,
  };
}

describe("useCreateAgent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns createAgentBlock and handleCreateAgent", () => {
    const { result } = renderHook(() => useCreateAgent(makeParams()));
    expect(result.current.handleCreateAgent).toBeTypeOf("function");
    expect(result.current.createAgentBlock).toBeNull();
    expect(result.current.createAgentBusy).toBe(false);
  });

  it("creates agent and dispatches selectAgent", async () => {
    const params = makeParams();
    const { result } = renderHook(() => useCreateAgent(params));

    await act(async () => {
      await result.current.handleCreateAgent();
    });

    expect(params.enqueueConfigMutation).toHaveBeenCalledTimes(1);
    expect(params.dispatch).toHaveBeenCalledWith({
      type: "selectAgent",
      agentId: "new-agent-1",
    });
    expect(params.flushPendingDraft).toHaveBeenCalledWith("existing-1");
    expect(params.setFocusFilter).toHaveBeenCalledWith("all");
    expect(params.setSettingsAgentId).toHaveBeenCalledWith(null);
  });

  it("blocks when not connected", async () => {
    const params = makeParams({ status: "disconnected" });
    const { result } = renderHook(() => useCreateAgent(params));

    await act(async () => {
      await result.current.handleCreateAgent();
    });

    expect(params.setError).toHaveBeenCalledWith("Connect to gateway before creating an agent.");
    expect(params.enqueueConfigMutation).not.toHaveBeenCalled();
  });

  it("blocks when isBusy", async () => {
    const params = makeParams({ isBusy: true });
    const { result } = renderHook(() => useCreateAgent(params));

    await act(async () => {
      await result.current.handleCreateAgent();
    });

    expect(params.enqueueConfigMutation).not.toHaveBeenCalled();
  });

  it("generates unique name when default exists", async () => {
    const params = makeParams({
      stateRef: {
        current: {
          agents: [{ name: "New Agent" }],
        },
      } as React.RefObject<{ agents: { name: string }[] }>,
    });
    const { result } = renderHook(() => useCreateAgent(params));

    await act(async () => {
      await result.current.handleCreateAgent();
    });

    // Should have created with "New Agent 2" since "New Agent" exists
    expect(params.enqueueConfigMutation).toHaveBeenCalledTimes(1);
  });

  it("handles creation error", async () => {
    const params = makeParams({
      enqueueConfigMutation: vi.fn().mockRejectedValue(new Error("Config write failed")),
    });
    const { result } = renderHook(() => useCreateAgent(params));

    await act(async () => {
      await result.current.handleCreateAgent();
    });

    expect(params.setError).toHaveBeenCalledWith("Config write failed");
    expect(result.current.createAgentBusy).toBe(false);
  });
});
