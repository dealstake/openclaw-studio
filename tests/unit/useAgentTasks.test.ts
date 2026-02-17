import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAgentTasks } from "@/features/tasks/hooks/useAgentTasks";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { CronJobSummary } from "@/lib/cron/types";
import type { StudioTask } from "@/features/tasks/types";

afterEach(cleanup);

// ─── Mock sonner ─────────────────────────────────────────────────────────────
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<GatewayClient> = {}): GatewayClient {
  return {
    call: vi.fn().mockResolvedValue({ ok: true, jobId: "cron-new" }),
    status: "connected" as GatewayStatus,
    ...overrides,
  } as unknown as GatewayClient;
}

function makeTask(overrides: Partial<StudioTask> = {}): StudioTask {
  return {
    id: "task-1",
    cronJobId: "cron-1",
    agentId: "agent-1",
    name: "Test Task",
    description: "",
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 3_600_000 },
    prompt: "Do something",
    model: "anthropic/claude-sonnet-4-6",
    deliveryChannel: null,
    deliveryTarget: null,
    enabled: true,
    createdAt: "2026-02-17T00:00:00Z",
    updatedAt: "2026-02-17T00:00:00Z",
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    ...overrides,
  };
}

function makeCronJob(overrides: Partial<CronJobSummary> = {}): CronJobSummary {
  return {
    id: "cron-1",
    name: "[TASK] Test Task",
    enabled: true,
    agentId: "agent-1",
    schedule: { kind: "every", everyMs: 3_600_000 },
    payload: { kind: "agentTurn", message: "Do something", model: "default" },
    sessionTarget: "isolated",
    createdAtMs: Date.now(),
    state: { runCount: 5, lastRunAtMs: Date.now() - 60_000, lastStatus: "ok" },
    ...overrides,
  } as CronJobSummary;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useAgentTasks", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("initializes with empty state", () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useAgentTasks(client, "connected", "agent-1", [])
    );
    expect(result.current.tasks).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("loadTasks fetches and enriches tasks with cron data", async () => {
    const task = makeTask();
    const cronJob = makeCronJob({ state: { runCount: 10, lastRunAtMs: Date.now(), lastStatus: "ok" } });
    const client = makeClient();

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: [task] }),
    } as Response);

    const { result } = renderHook(() =>
      useAgentTasks(client, "connected", "agent-1", [cronJob])
    );

    await act(async () => {
      await result.current.loadTasks();
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].enabled).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("loadTasks synthesizes orphan cron jobs", async () => {
    const orphanCron = makeCronJob({ id: "cron-orphan", name: "" });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: [] }),
    } as Response);

    const { result } = renderHook(() =>
      useAgentTasks(makeClient(), "connected", "agent-1", [orphanCron])
    );

    await act(async () => {
      await result.current.loadTasks();
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].name).toContain("UNMANAGED");
    expect(result.current.tasks[0].cronJobId).toBe("cron-orphan");
  });

  it("loadTasks sets error on fetch failure", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    } as Response);

    const { result } = renderHook(() =>
      useAgentTasks(makeClient(), "connected", "agent-1", [])
    );

    await act(async () => {
      await result.current.loadTasks();
    });

    expect(result.current.error).toBe("Server error");
  });

  it("loadTasks does nothing when disconnected", async () => {
    const { result } = renderHook(() =>
      useAgentTasks(makeClient(), "disconnected", "agent-1", [])
    );

    await act(async () => {
      await result.current.loadTasks();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loadTasks does nothing when agentId is null", async () => {
    const { result } = renderHook(() =>
      useAgentTasks(makeClient(), "connected", null, [])
    );

    await act(async () => {
      await result.current.loadTasks();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
