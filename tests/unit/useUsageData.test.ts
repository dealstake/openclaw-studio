import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useUsageData } from "@/features/usage/hooks/useUsageData";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

afterEach(cleanup);

vi.mock("@/lib/gateway/GatewayClient", () => ({
  isGatewayDisconnectLikeError: vi.fn().mockReturnValue(false),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(sessions: unknown[] = []): GatewayClient {
  return {
    call: vi.fn().mockResolvedValue({ sessions }),
  } as unknown as GatewayClient;
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    key: "sess-1",
    displayName: "Test Session",
    model: "anthropic/claude-opus-4-0620",
    inputTokens: 1000,
    outputTokens: 500,
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useUsageData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with empty state", () => {
    const { result } = renderHook(() => useUsageData(makeClient(), "connected"));
    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.timeRange).toBe("7d");
    expect(result.current.totalCost).toBe(0);
    expect(result.current.totalSessions).toBe(0);
  });

  it("fetches sessions on refresh", async () => {
    const sessions = [makeSession()];
    const client = makeClient(sessions);
    const { result } = renderHook(() => useUsageData(client, "connected"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(client.call).toHaveBeenCalledWith("sessions.list", {
      includeGlobal: true,
      includeUnknown: true,
      limit: 2000,
    });
    expect(result.current.totalSessions).toBeGreaterThan(0);
  });

  it("does not fetch when disconnected", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useUsageData(client, "disconnected"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(client.call).not.toHaveBeenCalled();
  });

  it("throttles rapid refreshes", async () => {
    const client = makeClient([makeSession()]);
    const { result } = renderHook(() => useUsageData(client, "connected"));

    await act(async () => {
      await result.current.refresh();
    });
    expect(client.call).toHaveBeenCalledTimes(1);

    // Immediate second call should be throttled
    await act(async () => {
      await result.current.refresh();
    });
    expect(client.call).toHaveBeenCalledTimes(1);

    // After throttle window, should work again
    vi.advanceTimersByTime(6000);
    await act(async () => {
      await result.current.refresh();
    });
    expect(client.call).toHaveBeenCalledTimes(2);
  });

  it("handles errors gracefully", async () => {
    const client = {
      call: vi.fn().mockRejectedValue(new Error("Network error")),
    } as unknown as GatewayClient;
    const { result } = renderHook(() => useUsageData(client, "connected"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.entries).toEqual([]);
  });

  it("changes time range", async () => {
    const client = makeClient([makeSession()]);
    const { result } = renderHook(() => useUsageData(client, "connected"));

    await act(async () => {
      await result.current.refresh();
    });

    act(() => {
      result.current.setTimeRange("30d");
    });

    expect(result.current.timeRange).toBe("30d");
  });

  it("computes derived state (costByModel, totals)", async () => {
    const sessions = [
      makeSession({ key: "s1", inputTokens: 10000, outputTokens: 5000 }),
      makeSession({ key: "s2", inputTokens: 20000, outputTokens: 10000, model: "anthropic/claude-sonnet-4" }),
    ];
    const client = makeClient(sessions);
    const { result } = renderHook(() => useUsageData(client, "connected"));

    // Set to "all" to include everything
    act(() => {
      result.current.setTimeRange("all");
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.totalInputTokens).toBeGreaterThan(0);
    expect(result.current.totalOutputTokens).toBeGreaterThan(0);
    expect(result.current.costByModel.size).toBeGreaterThan(0);
  });
});
