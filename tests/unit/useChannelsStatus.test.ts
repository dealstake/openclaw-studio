import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChannelsStatus } from "@/features/channels/hooks/useChannelsStatus";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

function createMockClient(callResult?: unknown, callError?: Error) {
  return {
    call: callError ? vi.fn().mockRejectedValue(callError) : vi.fn().mockResolvedValue(callResult),
  } as unknown as GatewayClient;
}

describe("useChannelsStatus", () => {
  let client: GatewayClient;

  beforeEach(() => {
    client = createMockClient({
      channels: {
        whatsapp: { configured: true, running: true, connected: true },
        telegram: { configured: true, running: false, connected: false },
        discord: { configured: false, running: false, connected: false },
      },
    });
  });

  it("returns initial state", () => {
    const { result } = renderHook(() => useChannelsStatus(client, "disconnected"));
    expect(result.current.channelsSnapshot).toBeNull();
    expect(result.current.channelsLoading).toBe(false);
    expect(result.current.channelsError).toBeNull();
    expect(result.current.connectedChannelCount).toBe(0);
    expect(result.current.totalChannelCount).toBe(0);
  });

  it("loads channels when connected", async () => {
    const { result } = renderHook(() => useChannelsStatus(client, "connected"));
    await act(async () => {
      await result.current.loadChannelsStatus();
    });
    expect(client.call).toHaveBeenCalledWith("channels.status", {});
    expect(result.current.channelsSnapshot).not.toBeNull();
    expect(result.current.connectedChannelCount).toBe(1); // whatsapp connected
    expect(result.current.totalChannelCount).toBe(2); // whatsapp + telegram (discord has nothing)
  });

  it("does not load when disconnected", async () => {
    const { result } = renderHook(() => useChannelsStatus(client, "disconnected"));
    await act(async () => {
      await result.current.loadChannelsStatus();
    });
    expect(client.call).not.toHaveBeenCalled();
  });

  it("handles errors", async () => {
    const errClient = createMockClient(undefined, new Error("Network fail"));
    const { result } = renderHook(() => useChannelsStatus(errClient, "connected"));
    await act(async () => {
      await result.current.loadChannelsStatus();
    });
    expect(result.current.channelsError).toBe("Network fail");
  });

  it("resets state", async () => {
    const { result } = renderHook(() => useChannelsStatus(client, "connected"));
    await act(async () => {
      await result.current.loadChannelsStatus();
    });
    expect(result.current.channelsSnapshot).not.toBeNull();
    act(() => {
      result.current.resetChannelsStatus();
    });
    expect(result.current.channelsSnapshot).toBeNull();
    expect(result.current.channelsLoading).toBe(false);
  });

  it("derives counts via useMemo from snapshot", async () => {
    const allConnected = createMockClient({
      channels: {
        whatsapp: { configured: true, running: true, connected: true },
        telegram: { configured: true, running: true, connected: true },
      },
    });
    const { result } = renderHook(() => useChannelsStatus(allConnected, "connected"));
    await act(async () => {
      await result.current.loadChannelsStatus();
    });
    expect(result.current.connectedChannelCount).toBe(2);
    expect(result.current.totalChannelCount).toBe(2);
  });
});
