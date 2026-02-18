import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCronAnalytics } from "@/features/activity/hooks/useCronAnalytics";
import type { CronJobSummary } from "@/lib/cron/types";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

const makeJob = (id: string, name: string): CronJobSummary => ({
  id,
  name,
  enabled: true,
  updatedAtMs: Date.now(),
  schedule: { kind: "every", everyMs: 300000 },
  payload: { kind: "agentTurn", message: "test" },
  sessionTarget: "isolated",
  wakeMode: "next-heartbeat",
  state: {},
});

const makeMockClient = (
  cronRuns: Record<string, { runs: Array<{ id: string; jobId: string; status: string; startedAtMs: number; durationMs: number }> }>,
  sessions: Array<{ key: string; updatedAt: number; totalTokens: number }>
): GatewayClient => ({
  call: vi.fn(async (method: string, params?: Record<string, unknown>) => {
    if (method === "cron.runs") {
      const jobId = params?.jobId as string;
      return cronRuns[jobId] ?? { runs: [] };
    }
    if (method === "sessions.list") {
      return { sessions };
    }
    return {};
  }),
  onEvent: vi.fn(() => () => {}),
}) as unknown as GatewayClient;

describe("useCronAnalytics", () => {
  let mockClient: GatewayClient;

  beforeEach(() => {
    mockClient = makeMockClient(
      {
        "job-1": {
          runs: [
            { id: "r1", jobId: "job-1", status: "ok", startedAtMs: 1000, durationMs: 5000 },
            { id: "r2", jobId: "job-1", status: "ok", startedAtMs: 2000, durationMs: 3000 },
            { id: "r3", jobId: "job-1", status: "error", startedAtMs: 3000, durationMs: 1000 },
          ],
        },
        "job-2": {
          runs: [
            { id: "r4", jobId: "job-2", status: "ok", startedAtMs: 4000, durationMs: 10000 },
          ],
        },
      },
      [
        { key: "s1", updatedAt: 1010, totalTokens: 5000 },
        { key: "s2", updatedAt: 4010, totalTokens: 8000 },
      ]
    );
  });

  it("returns empty stats initially", () => {
    const { result } = renderHook(() =>
      useCronAnalytics(mockClient, "disconnected" as GatewayStatus, [])
    );
    expect(result.current.jobStats).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("does not fetch when disconnected", async () => {
    const { result } = renderHook(() =>
      useCronAnalytics(mockClient, "disconnected" as GatewayStatus, [makeJob("job-1", "Job 1")])
    );
    await act(async () => {
      result.current.refresh();
    });
    expect(mockClient.call).not.toHaveBeenCalled();
  });

  it("fetches and computes stats when connected", async () => {
    const jobs = [makeJob("job-1", "Job 1"), makeJob("job-2", "Job 2")];
    const { result } = renderHook(() =>
      useCronAnalytics(mockClient, "connected" as GatewayStatus, jobs)
    );

    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.jobStats).toHaveLength(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    // Verify both jobs have stats computed
    const names = result.current.jobStats.map((s) => s.jobName);
    expect(names).toContain("Job 1");
    expect(names).toContain("Job 2");
    // Ranked by tokens descending
    expect(result.current.jobStats[0].totalTokens).toBeGreaterThanOrEqual(
      result.current.jobStats[1].totalTokens
    );
  });

  it("computes correct run counts", async () => {
    const jobs = [makeJob("job-1", "Job 1")];
    const { result } = renderHook(() =>
      useCronAnalytics(mockClient, "connected" as GatewayStatus, jobs)
    );

    await act(async () => {
      result.current.refresh();
    });

    const job1 = result.current.jobStats[0];
    expect(job1.totalRuns).toBe(3);
    expect(job1.successCount).toBe(2);
    expect(job1.failCount).toBe(1);
    expect(job1.successRate).toBeCloseTo(2 / 3);
  });

  it("handles RPC error gracefully", async () => {
    const errorClient = {
      call: vi.fn(async () => {
        throw new Error("RPC failed");
      }),
      onEvent: vi.fn(() => () => {}),
    } as unknown as GatewayClient;

    const { result } = renderHook(() =>
      useCronAnalytics(errorClient, "connected" as GatewayStatus, [makeJob("job-1", "Job 1")])
    );

    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.error).toBe("RPC failed");
    expect(result.current.jobStats).toEqual([]);
  });

  it("skips disabled jobs", async () => {
    const disabledJob: CronJobSummary = { ...makeJob("job-3", "Disabled"), enabled: false };
    const jobs = [makeJob("job-1", "Job 1"), disabledJob];
    const { result } = renderHook(() =>
      useCronAnalytics(mockClient, "connected" as GatewayStatus, jobs)
    );

    await act(async () => {
      result.current.refresh();
    });

    // Only job-1 should have stats (disabled job skipped)
    expect(result.current.jobStats).toHaveLength(1);
    expect(result.current.jobStats[0].jobName).toBe("Job 1");
  });
});
