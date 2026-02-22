import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAllCronJobs } from "@/features/cron/hooks/useAllCronJobs";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

// Mock cron lib
vi.mock("@/lib/cron/types", () => ({
  listCronJobs: vi.fn(),
  runCronJobNow: vi.fn(),
  removeCronJob: vi.fn(),
  updateCronJob: vi.fn(),
}));

vi.mock("@/lib/gateway/GatewayClient", () => ({
  isGatewayDisconnectLikeError: vi.fn(() => false),
}));

import {
  listCronJobs,
  runCronJobNow,
  removeCronJob,
  updateCronJob,
} from "@/lib/cron/types";

const mockClient = { call: vi.fn() } as unknown as GatewayClient;

function makeJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "job-1",
    name: "Test Job",
    enabled: true,
    agentId: "alex",
    schedule: { kind: "every", everyMs: 60000 },
    payload: { kind: "systemEvent", text: "hello" },
    delivery: null,
    state: {
      lastStatus: "ok",
      lastRunAtMs: 1000,
      nextRunAtMs: 2000,
      runCount: 5,
      lastDurationMs: 1200,
      lastError: null,
      runningAtMs: null,
    },
    updatedAtMs: Date.now(),
    ...overrides,
  };
}

describe("useAllCronJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads cron jobs when connected", async () => {
    const job = makeJob();
    vi.mocked(listCronJobs).mockResolvedValue({ jobs: [job] });

    const { result } = renderHook(() =>
      useAllCronJobs(mockClient, "connected"),
    );

    await act(() => result.current.loadAllCronJobs());

    expect(listCronJobs).toHaveBeenCalledWith(mockClient, {
      includeDisabled: true,
    });
    expect(result.current.allCronJobs).toHaveLength(1);
    expect(result.current.allCronError).toBeNull();
    expect(result.current.allCronLoading).toBe(false);
  });

  it("does not load when disconnected", async () => {
    const { result } = renderHook(() =>
      useAllCronJobs(mockClient, "disconnected"),
    );

    await act(() => result.current.loadAllCronJobs());

    expect(listCronJobs).not.toHaveBeenCalled();
  });

  it("handles load error", async () => {
    vi.mocked(listCronJobs).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useAllCronJobs(mockClient, "connected"),
    );

    await act(() => result.current.loadAllCronJobs());

    expect(result.current.allCronError).toBe("Network error");
  });

  it("runs a job", async () => {
    const job = makeJob();
    vi.mocked(listCronJobs).mockResolvedValue({ jobs: [job] });
    vi.mocked(runCronJobNow).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAllCronJobs(mockClient, "connected"),
    );

    await act(() => result.current.loadAllCronJobs());
    await act(() => result.current.handleAllCronRunJob("job-1"));

    expect(runCronJobNow).toHaveBeenCalledWith(mockClient, "job-1");
  });

  it("deletes a job", async () => {
    const job = makeJob();
    vi.mocked(listCronJobs).mockResolvedValue({ jobs: [job] });
    vi.mocked(removeCronJob).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAllCronJobs(mockClient, "connected"),
    );

    await act(() => result.current.loadAllCronJobs());
    await act(() => result.current.handleAllCronDeleteJob("job-1"));

    expect(removeCronJob).toHaveBeenCalledWith(mockClient, "job-1");
  });

  it("toggles enabled state optimistically", async () => {
    const job = makeJob({ enabled: true });
    vi.mocked(listCronJobs).mockResolvedValue({ jobs: [job] });
    vi.mocked(updateCronJob).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAllCronJobs(mockClient, "connected"),
    );

    await act(() => result.current.loadAllCronJobs());
    await act(() => result.current.handleAllCronToggleEnabled("job-1"));

    expect(updateCronJob).toHaveBeenCalledWith(mockClient, "job-1", {
      enabled: false,
    });
    expect(result.current.allCronJobs[0].enabled).toBe(false);
  });

  it("handles toggle error", async () => {
    const job = makeJob();
    vi.mocked(listCronJobs).mockResolvedValue({ jobs: [job] });
    vi.mocked(updateCronJob).mockRejectedValue(new Error("Toggle failed"));

    const { result } = renderHook(() =>
      useAllCronJobs(mockClient, "connected"),
    );

    await act(() => result.current.loadAllCronJobs());
    await act(() => result.current.handleAllCronToggleEnabled("job-1"));

    expect(result.current.allCronError).toBe("Toggle failed");
  });
});
