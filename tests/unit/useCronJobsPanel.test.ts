import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useCronJobsPanel } from "@/features/agents/hooks/useCronJobsPanel";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { CronJobSummary } from "@/lib/cron/types";

afterEach(cleanup);

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/cron/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cron/types")>();
  return {
    ...actual,
    listCronJobs: vi.fn().mockResolvedValue({ jobs: [] }),
    filterCronJobsForAgent: actual.filterCronJobsForAgent,
    removeCronJob: vi.fn().mockResolvedValue({ ok: true, removed: true }),
    runCronJobNow: vi.fn().mockResolvedValue({ ok: true, ran: true }),
    updateCronJob: vi.fn().mockResolvedValue({ ok: true }),
  };
});

const mocks = await import("@/lib/cron/types");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(): GatewayClient {
  return { call: vi.fn().mockResolvedValue({ ok: true }) } as unknown as GatewayClient;
}

function makeJob(overrides: Partial<CronJobSummary> = {}): CronJobSummary {
  return {
    id: "job-1",
    name: "Test Job",
    agentId: "agent-1",
    enabled: true,
    updatedAtMs: Date.now(),
    schedule: { kind: "every", everyMs: 300000 },
    sessionTarget: "isolated",
    wakeMode: "next-heartbeat",
    payload: { kind: "agentTurn", message: "test" },
    state: {},
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useCronJobsPanel", () => {
  it("initializes with empty state", () => {
    const { result } = renderHook(() => useCronJobsPanel({ client: makeClient() }));
    expect(result.current.cronJobs).toEqual([]);
    expect(result.current.cronLoading).toBe(false);
    expect(result.current.cronError).toBeNull();
    expect(result.current.cronRunBusyJobId).toBeNull();
    expect(result.current.cronDeleteBusyJobId).toBeNull();
  });

  it("loads and filters cron jobs for agent", async () => {
    const job = makeJob({ agentId: "agent-1" });
    const otherJob = makeJob({ id: "job-2", agentId: "agent-2" });
    vi.mocked(mocks.listCronJobs).mockResolvedValueOnce({ jobs: [job, otherJob] });

    const { result } = renderHook(() => useCronJobsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.loadCronJobs("agent-1");
    });

    expect(result.current.cronJobs).toHaveLength(1);
    expect(result.current.cronJobs[0].id).toBe("job-1");
    expect(result.current.cronLoading).toBe(false);
  });

  it("sets error on empty agent id", async () => {
    const { result } = renderHook(() => useCronJobsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.loadCronJobs("  ");
    });

    expect(result.current.cronJobs).toEqual([]);
    expect(result.current.cronError).toContain("missing agent id");
  });

  it("sets error when listCronJobs fails", async () => {
    vi.mocked(mocks.listCronJobs).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useCronJobsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.loadCronJobs("agent-1");
    });

    expect(result.current.cronError).toBe("Network error");
    expect(result.current.cronJobs).toEqual([]);
  });

  it("runs a cron job and reloads", async () => {
    vi.mocked(mocks.listCronJobs).mockResolvedValue({ jobs: [] });

    const { result } = renderHook(() => useCronJobsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.handleRunCronJob("agent-1", "job-1");
    });

    expect(mocks.runCronJobNow).toHaveBeenCalledWith(expect.anything(), "job-1");
    expect(mocks.listCronJobs).toHaveBeenCalled();
  });

  it("deletes a cron job and reloads", async () => {
    vi.mocked(mocks.listCronJobs).mockResolvedValue({ jobs: [] });

    const { result } = renderHook(() => useCronJobsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.handleDeleteCronJob("agent-1", "job-1");
    });

    expect(mocks.removeCronJob).toHaveBeenCalledWith(expect.anything(), "job-1");
  });

  it("toggles a cron job enabled state", async () => {
    vi.mocked(mocks.listCronJobs).mockResolvedValue({ jobs: [] });

    const { result } = renderHook(() => useCronJobsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.handleToggleCronJob("agent-1", "job-1", false);
    });

    expect(mocks.updateCronJob).toHaveBeenCalledWith(expect.anything(), "job-1", { enabled: false });
  });

  it("guards against concurrent run and delete", async () => {
    let resolveRun: () => void;
    vi.mocked(mocks.runCronJobNow).mockImplementation(
      () => new Promise((resolve) => { resolveRun = () => resolve({ ok: true, ran: true }); })
    );
    vi.mocked(mocks.listCronJobs).mockResolvedValue({ jobs: [] });
    vi.mocked(mocks.removeCronJob).mockClear();

    const { result } = renderHook(() => useCronJobsPanel({ client: makeClient() }));

    let runPromise: Promise<void>;
    await act(async () => {
      runPromise = result.current.handleRunCronJob("agent-1", "job-1");
    });

    expect(result.current.cronRunBusyJobId).toBe("job-1");

    // Delete should be blocked
    await act(async () => {
      await result.current.handleDeleteCronJob("agent-1", "job-2");
    });
    expect(mocks.removeCronJob).not.toHaveBeenCalled();

    await act(async () => {
      resolveRun!();
      await runPromise!;
    });
  });

  it("resets all state", async () => {
    vi.mocked(mocks.listCronJobs).mockResolvedValue({ jobs: [makeJob()] });

    const { result } = renderHook(() => useCronJobsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.loadCronJobs("agent-1");
    });
    expect(result.current.cronJobs).toHaveLength(1);

    act(() => {
      result.current.resetCron();
    });

    expect(result.current.cronJobs).toEqual([]);
    expect(result.current.cronLoading).toBe(false);
    expect(result.current.cronError).toBeNull();
  });

  it("no-ops run with empty ids", async () => {
    vi.mocked(mocks.runCronJobNow).mockClear();

    const { result } = renderHook(() => useCronJobsPanel({ client: makeClient() }));

    await act(async () => {
      await result.current.handleRunCronJob("", "job-1");
    });
    expect(mocks.runCronJobNow).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleRunCronJob("agent-1", "  ");
    });
    expect(mocks.runCronJobNow).not.toHaveBeenCalled();
  });
});
