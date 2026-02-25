import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionUsage } from "@/features/sessions/hooks/useSessionUsage";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

function makeClient(result: unknown = { totals: {}, sessions: [] }) {
  return {
    call: vi.fn().mockResolvedValue(result),
  } as unknown as GatewayClient;
}

const USAGE_RESULT = {
  totals: { input: 1000, output: 500, totalTokens: 1500, totalCost: 0.05 },
  sessions: [
    { usage: { messageCounts: { total: 10 } } },
    { usage: { messageCounts: { total: 5 } } },
  ],
};

describe("useSessionUsage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("loads usage for a session key", async () => {
    const client = makeClient(USAGE_RESULT);
    const { result } = renderHook(() => useSessionUsage(client, "connected"));

    expect(result.current.sessionUsage).toBeNull();

    await act(async () => {
      await result.current.loadSessionUsage("test-session");
    });

    expect(client.call).toHaveBeenCalledWith("sessions.usage", { key: "test-session" });
    expect(result.current.sessionUsage).toEqual({
      inputTokens: 1000,
      outputTokens: 500,
      totalCost: 0.05,
      currency: "USD",
      messageCount: 15,
    });
    expect(result.current.sessionUsageLoading).toBe(false);
  });

  it("returns null usage when not connected", async () => {
    const client = makeClient(USAGE_RESULT);
    const { result } = renderHook(() => useSessionUsage(client, "disconnected"));

    await act(async () => {
      await result.current.loadSessionUsage("test-session");
    });

    expect(client.call).not.toHaveBeenCalled();
    expect(result.current.sessionUsage).toBeNull();
  });

  it("throttles calls within 5 seconds", async () => {
    const client = makeClient(USAGE_RESULT);
    const { result } = renderHook(() => useSessionUsage(client, "connected"));

    await act(async () => {
      await result.current.loadSessionUsage("s1");
    });
    expect(client.call).toHaveBeenCalledTimes(1);

    // Second call within throttle window — should be skipped
    await act(async () => {
      await result.current.loadSessionUsage("s1");
    });
    expect(client.call).toHaveBeenCalledTimes(1);

    // Advance past throttle window
    vi.advanceTimersByTime(5001);
    await act(async () => {
      await result.current.loadSessionUsage("s1");
    });
    expect(client.call).toHaveBeenCalledTimes(2);
  });

  it("handles RPC errors gracefully", async () => {
    const client = {
      call: vi.fn().mockRejectedValue(new Error("network error")),
    } as unknown as GatewayClient;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useSessionUsage(client, "connected"));

    await act(async () => {
      await result.current.loadSessionUsage("s1");
    });

    expect(result.current.sessionUsage).toBeNull();
    expect(result.current.sessionUsageLoading).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("resets usage state", async () => {
    const client = makeClient(USAGE_RESULT);
    const { result } = renderHook(() => useSessionUsage(client, "connected"));

    await act(async () => {
      await result.current.loadSessionUsage("s1");
    });
    expect(result.current.sessionUsage).not.toBeNull();

    act(() => {
      result.current.resetSessionUsage();
    });
    expect(result.current.sessionUsage).toBeNull();
  });

  it("parses zero-cost as null", async () => {
    const client = makeClient({
      totals: { input: 100, output: 50, totalTokens: 150, totalCost: 0 },
      sessions: [],
    });
    const { result } = renderHook(() => useSessionUsage(client, "connected"));

    await act(async () => {
      await result.current.loadSessionUsage("s1");
    });

    expect(result.current.sessionUsage?.totalCost).toBeNull();
  });
});

// useCumulativeUsage tests removed — hook was dead code (sessions.usage aggregate eliminated)
