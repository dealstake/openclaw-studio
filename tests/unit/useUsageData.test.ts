import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUsageData } from "@/features/usage/hooks/useUsageData";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

function makeClient(sessions: unknown[] = []) {
  return {
    call: vi.fn().mockResolvedValue({ sessions }),
  } as unknown as GatewayClient;
}

const NOW = Date.now();

const SAMPLE_SESSIONS = [
  {
    key: "session-1",
    displayName: "Chat 1",
    model: "claude-opus-4-0620",
    inputTokens: 1000,
    outputTokens: 500,
    updatedAt: NOW - 3600_000, // 1 hour ago
  },
  {
    key: "cron-abc-123",
    displayName: "Cron Run",
    model: "claude-sonnet-4-0514",
    inputTokens: 200,
    outputTokens: 100,
    updatedAt: NOW - 7200_000, // 2 hours ago
  },
];

describe("useUsageData", () => {
  it("fetches and computes costs on refresh", async () => {
    const client = makeClient(SAMPLE_SESSIONS);
    const { result } = renderHook(() => useUsageData(client, "connected"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(client.call).toHaveBeenCalledWith("sessions.list", {
      includeGlobal: true,
      includeUnknown: true,
      limit: 200,
    });
    expect(result.current.totalSessions).toBe(2);
    expect(result.current.totalCost).toBeGreaterThan(0);
    expect(result.current.costByModel.size).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("does not fetch when disconnected", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useUsageData(client, "disconnected"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(client.call).not.toHaveBeenCalled();
  });

  it("filters by time range", async () => {
    const oldSession = {
      key: "old",
      model: "claude-opus-4-0620",
      inputTokens: 100,
      outputTokens: 50,
      updatedAt: NOW - 8 * 24 * 3600_000, // 8 days ago
    };
    const client = makeClient([...SAMPLE_SESSIONS, oldSession]);
    const { result } = renderHook(() => useUsageData(client, "connected"));

    await act(async () => {
      await result.current.refresh();
    });

    // Default is 7d, so old session should be filtered out
    expect(result.current.totalSessions).toBe(2);

    // Switch to all — should include old session
    act(() => {
      result.current.setTimeRange("all");
    });
    expect(result.current.totalSessions).toBe(3);
  });

  it("handles API errors gracefully", async () => {
    const client = {
      call: vi.fn().mockRejectedValue(new Error("Network error")),
    } as unknown as GatewayClient;
    const { result } = renderHook(() => useUsageData(client, "connected"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.totalSessions).toBe(0);
  });
});
