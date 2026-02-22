import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGatewayStatus } from "@/lib/gateway/useGatewayStatus";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

function createMockClient(overrides: Partial<GatewayClient> = {}): GatewayClient {
  return {
    getLastHello: vi.fn().mockReturnValue(null),
    call: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as GatewayClient;
}

describe("useGatewayStatus", () => {
  let client: GatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("returns version and uptime from hello payload", () => {
    const mockClient = createMockClient({
      getLastHello: vi.fn().mockReturnValue({
        version: "2026.2.9",
        startedAtMs: 1708600000000,
      }),
    });

    const { result } = renderHook(() => useGatewayStatus(mockClient, "connected"));

    act(() => {
      result.current.loadGatewayStatus();
    });

    expect(result.current.gatewayVersion).toBe("2026.2.9");
    expect(result.current.gatewayUptime).toBe(1708600000000);
  });

  it("no-ops loadGatewayStatus when disconnected", () => {
    const getLastHello = vi.fn();
    const mockClient = createMockClient({ getLastHello });

    const { result } = renderHook(() => useGatewayStatus(mockClient, "disconnected"));

    act(() => {
      result.current.loadGatewayStatus();
    });

    expect(getLastHello).not.toHaveBeenCalled();
    expect(result.current.gatewayVersion).toBeUndefined();
  });

  it("parses presence from status RPC", async () => {
    const mockClient = createMockClient({
      call: vi.fn().mockResolvedValue({
        presence: [
          { agentId: "alex", active: true },
          { agentId: "bob", active: false },
          { agentId: "charlie", active: true },
        ],
      }),
    });

    const { result } = renderHook(() => useGatewayStatus(mockClient, "connected"));

    await act(async () => {
      await result.current.parsePresenceFromStatus();
    });

    expect(result.current.presenceAgentIds).toEqual(["alex", "charlie"]);
  });

  it("no-ops parsePresenceFromStatus when disconnected", async () => {
    const call = vi.fn();
    const mockClient = createMockClient({ call });

    const { result } = renderHook(() => useGatewayStatus(mockClient, "disconnected"));

    await act(async () => {
      await result.current.parsePresenceFromStatus();
    });

    expect(call).not.toHaveBeenCalled();
    expect(result.current.presenceAgentIds).toEqual([]);
  });

  it("does not re-render when presence unchanged", async () => {
    const presence = [{ agentId: "alex", active: true }];
    const mockClient = createMockClient({
      call: vi.fn().mockResolvedValue({ presence }),
    });

    const { result } = renderHook(() => useGatewayStatus(mockClient, "connected"));

    await act(async () => {
      await result.current.parsePresenceFromStatus();
    });
    const firstRef = result.current.presenceAgentIds;

    await act(async () => {
      await result.current.parsePresenceFromStatus();
    });
    const secondRef = result.current.presenceAgentIds;

    // Same reference — no unnecessary re-render
    expect(firstRef).toBe(secondRef);
  });

  it("resetPresence clears agent IDs", async () => {
    const mockClient = createMockClient({
      call: vi.fn().mockResolvedValue({
        presence: [{ agentId: "alex", active: true }],
      }),
    });

    const { result } = renderHook(() => useGatewayStatus(mockClient, "connected"));

    await act(async () => {
      await result.current.parsePresenceFromStatus();
    });
    expect(result.current.presenceAgentIds).toEqual(["alex"]);

    act(() => {
      result.current.resetPresence();
    });
    expect(result.current.presenceAgentIds).toEqual([]);
  });

  it("handles missing hello gracefully", () => {
    const mockClient = createMockClient({
      getLastHello: vi.fn().mockReturnValue(null),
    });

    const { result } = renderHook(() => useGatewayStatus(mockClient, "connected"));

    act(() => {
      result.current.loadGatewayStatus();
    });

    expect(result.current.gatewayVersion).toBeUndefined();
    expect(result.current.gatewayUptime).toBeUndefined();
  });
});
