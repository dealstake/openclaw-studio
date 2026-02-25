import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCronAnalytics } from "@/features/activity/hooks/useCronAnalytics";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { CronJobSummary, CronRunEntry } from "@/lib/cron/types";

// Mock fetchCronRuns
vi.mock("@/lib/cron/types", async () => {
  const actual = await vi.importActual("@/lib/cron/types");
  return {
    ...actual,
    fetchCronRuns: vi.fn(),
  };
});

// Mock GatewayClient disconnect check
vi.mock("@/lib/gateway/GatewayClient", async () => {
  const actual = await vi.importActual("@/lib/gateway/GatewayClient");
  return {
    ...actual,
    isGatewayDisconnectLikeError: () => false,
  };
});

import { fetchCronRuns } from "@/lib/cron/types";

function makeClient(): GatewayClient {
  return {
    call: vi.fn().mockResolvedValue({ sessions: [] }),
  } as unknown as GatewayClient;
}

function makeJob(id: string, name: string): CronJobSummary {
  return {
    id,
    name,
    enabled: true,
    schedule: { kind: "every", everyMs: 60000 },
    payload: { kind: "agentTurn", message: "test" },
    sessionTarget: "isolated",
  } as CronJobSummary;
}

function makeRun(id: string, status: string): CronRunEntry {
  return {
    id,
    status,
    startedAtMs: Date.now() - 60000,
    durationMs: 5000,
  } as CronRunEntry;
}

describe("useCronAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when disconnected", async () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useCronAnalytics(client, "disconnected" as GatewayStatus, [])
    );

    act(() => {
      result.current.refresh();
    });

    expect(client.call).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("fetches stats when connected", async () => {
    const client = makeClient();
    const jobs = [makeJob("j1", "Job 1")];
    const runs = [makeRun("r1", "ok"), makeRun("r2", "ok")];

    (fetchCronRuns as ReturnType<typeof vi.fn>).mockResolvedValue(runs);

    const { result } = renderHook(() =>
      useCronAnalytics(client, "connected" as GatewayStatus, jobs)
    );

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.jobStats).toHaveLength(1);
    expect(result.current.jobStats[0].totalRuns).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("skips disabled jobs", async () => {
    const client = makeClient();
    const jobs = [
      { ...makeJob("j1", "Enabled"), enabled: true },
      { ...makeJob("j2", "Disabled"), enabled: false },
    ];

    (fetchCronRuns as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useCronAnalytics(client, "connected" as GatewayStatus, jobs)
    );

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Only enabled job fetched
    expect(fetchCronRuns).toHaveBeenCalledTimes(1);
  });

  it("sets error on failure", async () => {
    const client = makeClient();
    const jobs = [makeJob("j1", "Job 1")];

    (fetchCronRuns as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("RPC failed")
    );

    const { result } = renderHook(() =>
      useCronAnalytics(client, "connected" as GatewayStatus, jobs)
    );

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("RPC failed");
  });
});
