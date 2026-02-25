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

// ─── Mock cron RPC functions ─────────────────────────────────────────────────
const mockUpdateCronJob = vi.fn().mockResolvedValue(undefined);
const mockRunCronJobNow = vi.fn().mockResolvedValue({ ok: true });
const mockRemoveCronJob = vi.fn().mockResolvedValue(undefined);
const mockAddCronJob = vi.fn().mockResolvedValue({ ok: true, jobId: "cron-new" });
const mockListCronJobs = vi.fn().mockResolvedValue({ jobs: [] });

vi.mock("@/lib/cron/types", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/cron/types")>();
  return {
    ...orig,
    updateCronJob: (...args: unknown[]) => mockUpdateCronJob(...args),
    runCronJobNow: (...args: unknown[]) => mockRunCronJobNow(...args),
    removeCronJob: (...args: unknown[]) => mockRemoveCronJob(...args),
    addCronJob: (...args: unknown[]) => mockAddCronJob(...args),
    listCronJobs: (...args: unknown[]) => mockListCronJobs(...args),
  };
});

// ─── Mock taskApi ────────────────────────────────────────────────────────────
const mockPatchTaskMetadata = vi.fn();
const mockDeleteTaskMetadata = vi.fn().mockResolvedValue(undefined);
const mockSaveTaskMetadata = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/tasks/lib/taskApi", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/features/tasks/lib/taskApi")>();
  return {
    ...orig,
    fetchTasks: orig.fetchTasks,
    patchTaskMetadata: (...args: unknown[]) => mockPatchTaskMetadata(...args),
    deleteTaskMetadata: (...args: unknown[]) => mockDeleteTaskMetadata(...args),
    saveTaskMetadata: (...args: unknown[]) => mockSaveTaskMetadata(...args),
  };
});

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
    managementStatus: "managed",
    name: "Test Task",
    description: "",
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 3_600_000 },
    prompt: "Do something",
    model: "anthropic/claude-sonnet-4-6",
    thinking: null,
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
    managementStatus: "managed",
    schedule: { kind: "every", everyMs: 3_600_000 },
    payload: { kind: "agentTurn", message: "Do something", model: "default" },
    sessionTarget: "isolated",
    createdAtMs: Date.now(),
    state: { runCount: 5, lastRunAtMs: Date.now() - 60_000, lastStatus: "ok" },
    ...overrides,
  } as CronJobSummary;
}

// Helper: render hook with tasks pre-loaded via fetch mock
// NOTE: caller must have fetchSpy set up via beforeEach
async function renderWithTasks(
  fetchSpyRef: ReturnType<typeof vi.spyOn>,
  tasks: StudioTask[],
  cronJobs: CronJobSummary[] = []
) {
  fetchSpyRef.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ tasks }),
  } as Response);
  mockListCronJobs.mockResolvedValueOnce({ jobs: cronJobs });

  const client = makeClient();
  const hook = renderHook(() =>
    useAgentTasks(client, "connected", "agent-1")
  );

  await act(async () => {
    await hook.result.current.loadTasks();
  });

  return { ...hook, client };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useAgentTasks", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
    mockUpdateCronJob.mockClear();
    mockRunCronJobNow.mockClear();
    mockRemoveCronJob.mockClear();
    mockAddCronJob.mockClear();
    mockListCronJobs.mockClear();
    mockListCronJobs.mockResolvedValue({ jobs: [] });
    mockPatchTaskMetadata.mockClear();
    mockDeleteTaskMetadata.mockClear();
    mockSaveTaskMetadata.mockClear();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── loadTasks ───────────────────────────────────────────────────────────

  it("initializes with empty state", () => {
    const client = makeClient();
    const { result } = renderHook(() =>
      useAgentTasks(client, "connected", "agent-1")
    );
    expect(result.current.tasks).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("loadTasks fetches and enriches tasks with cron data", async () => {
    const task = makeTask();
    const cronJob = makeCronJob({ state: { runCount: 10, lastRunAtMs: Date.now(), lastStatus: "ok" } });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: [task] }),
    } as Response);
    mockListCronJobs.mockResolvedValueOnce({ jobs: [cronJob] });

    const { result } = renderHook(() =>
      useAgentTasks(makeClient(), "connected", "agent-1")
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
    mockListCronJobs.mockResolvedValueOnce({ jobs: [orphanCron] });

    const { result } = renderHook(() =>
      useAgentTasks(makeClient(), "connected", "agent-1")
    );

    await act(async () => {
      await result.current.loadTasks();
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].managementStatus).toBe("unmanaged");
    expect(result.current.tasks[0].cronJobId).toBe("cron-orphan");
  });

  it("loadTasks sets error on fetch failure", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    } as Response);
    mockListCronJobs.mockResolvedValueOnce({ jobs: [] });

    const { result } = renderHook(() =>
      useAgentTasks(makeClient(), "connected", "agent-1")
    );

    await act(async () => {
      await result.current.loadTasks();
    });

    expect(result.current.error).toBe("Server error");
  });

  it("loadTasks does nothing when disconnected", async () => {
    const { result } = renderHook(() =>
      useAgentTasks(makeClient(), "disconnected", "agent-1")
    );

    await act(async () => {
      await result.current.loadTasks();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loadTasks does nothing when agentId is null", async () => {
    const { result } = renderHook(() =>
      useAgentTasks(makeClient(), "connected", null)
    );

    await act(async () => {
      await result.current.loadTasks();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ─── toggleTask ──────────────────────────────────────────────────────────

  it("toggleTask optimistically updates and confirms on success", async () => {
    const task = makeTask({ enabled: true });

    const { result, client } = await renderWithTasks(fetchSpy, [task]);

    expect(result.current.tasks[0].enabled).toBe(true);

    await act(async () => {
      await result.current.toggleTask("task-1", false);
    });

    // Only cron is updated — enabled is cron-owned, not persisted to Studio DB
    expect(mockUpdateCronJob).toHaveBeenCalledWith(client, "cron-1", { enabled: false });
    expect(mockPatchTaskMetadata).not.toHaveBeenCalled();
    expect(result.current.tasks[0].enabled).toBe(false);
    expect(result.current.busyTaskId).toBeNull();
  });

  it("toggleTask rolls back on cron update failure", async () => {
    const task = makeTask({ enabled: true });
    mockUpdateCronJob.mockRejectedValueOnce(new Error("Cron update failed"));

    const { result } = await renderWithTasks(fetchSpy, [task]);

    await act(async () => {
      await result.current.toggleTask("task-1", false);
    });

    // Should rollback to original state
    expect(result.current.tasks[0].enabled).toBe(true);
    expect(result.current.error).toBe("Cron update failed");
    expect(result.current.busyTaskId).toBeNull();
  });

  it("toggleTask ignores calls when task not found", async () => {
    const task = makeTask();
    const { result } = await renderWithTasks(fetchSpy, [task]);

    await act(async () => {
      await result.current.toggleTask("nonexistent", false);
    });

    // Should error because task not found
    expect(result.current.error).toBe("Task not found.");
  });

  // ─── runTask ─────────────────────────────────────────────────────────────

  it("runTask triggers the cron job", async () => {
    const task = makeTask();

    const { result, client } = await renderWithTasks(fetchSpy, [task]);

    await act(async () => {
      await result.current.runTask("task-1");
    });

    expect(mockRunCronJobNow).toHaveBeenCalledWith(client, "cron-1");
    expect(result.current.busyTaskId).toBeNull();
  });

  it("runTask sets error on failure", async () => {
    const task = makeTask();
    mockRunCronJobNow.mockRejectedValueOnce(new Error("Run failed"));

    const { result } = await renderWithTasks(fetchSpy, [task]);

    await act(async () => {
      await result.current.runTask("task-1");
    });

    expect(result.current.error).toBe("Run failed");
    expect(result.current.busyTaskId).toBeNull();
  });

  it("runTask errors when task not found", async () => {
    const { result } = await renderWithTasks(fetchSpy, []);

    await act(async () => {
      await result.current.runTask("nonexistent");
    });

    expect(result.current.error).toBe("Task not found.");
  });

  // ─── deleteTask ──────────────────────────────────────────────────────────

  it("deleteTask removes the task from state", async () => {
    const task = makeTask();
    const cron = makeCronJob();

    const { result, client } = await renderWithTasks(fetchSpy, [task], [cron]);

    expect(result.current.tasks).toHaveLength(1);

    await act(async () => {
      await result.current.deleteTask("task-1");
    });

    expect(mockRemoveCronJob).toHaveBeenCalledWith(client, "cron-1");
    expect(mockDeleteTaskMetadata).toHaveBeenCalledWith("agent-1", "task-1");
    expect(result.current.tasks).toHaveLength(0);
    expect(result.current.busyTaskId).toBeNull();
  });

  it("deleteTask sets error on failure", async () => {
    const task = makeTask();
    const cron = makeCronJob();
    mockRemoveCronJob.mockRejectedValueOnce(new Error("Delete failed"));

    const { result } = await renderWithTasks(fetchSpy, [task], [cron]);

    await act(async () => {
      await result.current.deleteTask("task-1");
    });

    expect(result.current.error).toBe("Delete failed");
    // Task should still be in list (no removal on error)
    expect(result.current.tasks).toHaveLength(1);
  });

  // ─── updateTask ──────────────────────────────────────────────────────────

  it("updateTask patches name and cron job name", async () => {
    const task = makeTask();
    const updated = { ...task, name: "New Name", updatedAt: "2026-02-20T00:00:00Z" };
    mockPatchTaskMetadata.mockResolvedValueOnce(updated);

    const { result, client } = await renderWithTasks(fetchSpy, [task]);

    await act(async () => {
      await result.current.updateTask("task-1", { name: "New Name" });
    });

    expect(mockUpdateCronJob).toHaveBeenCalledWith(client, "cron-1", { name: "[TASK] New Name" });
    // patchTaskMetadata updates UI metadata only (name, not schedule/enabled)
    expect(mockPatchTaskMetadata).toHaveBeenCalledWith("agent-1", "task-1", { name: "New Name" });
    expect(result.current.tasks[0].name).toBe("New Name");
  });

  it("updateTask patches prompt and model via cron payload", async () => {
    const task = makeTask();
    const updated = { ...task, prompt: "New prompt", model: "new-model", updatedAt: "2026-02-20T00:00:00Z" };
    mockPatchTaskMetadata.mockResolvedValueOnce(updated);

    const { result, client } = await renderWithTasks(fetchSpy, [task]);

    await act(async () => {
      await result.current.updateTask("task-1", { prompt: "New prompt", model: "new-model" });
    });

    // Should update cron payload
    expect(mockUpdateCronJob).toHaveBeenCalledWith(client, "cron-1", expect.objectContaining({
      payload: expect.objectContaining({
        kind: "agentTurn",
        model: "new-model",
      }),
    }));
    // patchTaskMetadata updates UI metadata only
    expect(mockPatchTaskMetadata).toHaveBeenCalledWith("agent-1", "task-1", { prompt: "New prompt", model: "new-model" });
    expect(result.current.tasks[0].prompt).toBe("New prompt");
  });

  // ─── updateTaskSchedule ──────────────────────────────────────────────────

  it("updateTaskSchedule changes schedule on cron only (cron-owned)", async () => {
    const task = makeTask();
    const newSchedule = { type: "periodic" as const, intervalMs: 1_800_000 };

    const { result, client } = await renderWithTasks(fetchSpy, [task]);

    await act(async () => {
      await result.current.updateTaskSchedule("task-1", newSchedule);
    });

    // taskScheduleToCronSchedule converts periodic → cron expression
    expect(mockUpdateCronJob).toHaveBeenCalledWith(client, "cron-1", {
      schedule: expect.objectContaining({ kind: "cron" }),
    });
    expect((result.current.tasks[0].schedule as { intervalMs: number }).intervalMs).toBe(1_800_000);
  });

  // ─── busyAction tracking ────────────────────────────────────────────────

  it("busyAction is null after toggle completes", async () => {
    const task = makeTask();

    const { result } = await renderWithTasks(fetchSpy, [task]);

    await act(async () => {
      await result.current.toggleTask("task-1", false);
    });

    expect(result.current.busyAction).toBeNull();
    expect(result.current.busyTaskId).toBeNull();
  });
});
