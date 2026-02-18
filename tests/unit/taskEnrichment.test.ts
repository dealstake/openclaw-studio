import { describe, expect, it } from "vitest";
import {
  generateTaskId,
  buildCronPayloadMessage,
  buildDelivery,
  enrichTasksWithCronData,
} from "@/features/tasks/lib/taskEnrichment";
import type { StudioTask, CreateTaskPayload } from "@/features/tasks/types";
import type { CronJobSummary } from "@/lib/cron/types";

// ─── generateTaskId ──────────────────────────────────────────────────────────

describe("generateTaskId", () => {
  it("returns a string starting with 'task-'", () => {
    expect(generateTaskId()).toMatch(/^task-/);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTaskId()));
    expect(ids.size).toBe(100);
  });
});

// ─── buildCronPayloadMessage ─────────────────────────────────────────────────

describe("buildCronPayloadMessage", () => {
  it("wraps prompt with task tag", () => {
    expect(buildCronPayloadMessage("task-abc", "Do the thing")).toBe(
      "[TASK:task-abc] Do the thing"
    );
  });
});

// ─── buildDelivery ───────────────────────────────────────────────────────────

describe("buildDelivery", () => {
  it("returns announce-only when no channel", () => {
    const payload = { deliveryChannel: null } as unknown as CreateTaskPayload;
    expect(buildDelivery(payload)).toEqual({ mode: "announce" });
  });

  it("includes channel when provided", () => {
    const payload = {
      deliveryChannel: "slack-general",
      deliveryTarget: null,
    } as unknown as CreateTaskPayload;
    expect(buildDelivery(payload)).toEqual({
      mode: "announce",
      channel: "slack-general",
    });
  });

  it("includes channel and target when both provided", () => {
    const payload = {
      deliveryChannel: "slack-general",
      deliveryTarget: "U12345",
    } as unknown as CreateTaskPayload;
    expect(buildDelivery(payload)).toEqual({
      mode: "announce",
      channel: "slack-general",
      to: "U12345",
    });
  });
});

// ─── enrichTasksWithCronData ─────────────────────────────────────────────────

function makeTask(overrides: Partial<StudioTask> = {}): StudioTask {
  return {
    id: "t1",
    cronJobId: "cron-1",
    agentId: "agent-1",
    name: "Test Task",
    description: "",
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 3600000 },
    prompt: "do stuff",
    model: "default",
    deliveryChannel: null,
    deliveryTarget: null,
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    ...overrides,
  };
}

function makeCronJob(overrides: Partial<CronJobSummary> = {}): CronJobSummary {
  return {
    id: "cron-1",
    name: "Test",
    enabled: true,
    agentId: "agent-1",
    schedule: { kind: "every", everyMs: 3600000 },
    payload: { kind: "agentTurn", message: "test" },
    sessionTarget: "isolated",
    state: { runCount: 0, lastStatus: null, lastRunAtMs: null },
    createdAtMs: Date.now(),
    ...overrides,
  } as CronJobSummary;
}

describe("enrichTasksWithCronData", () => {
  it("enriches task with matching cron data", () => {
    const tasks = [makeTask()];
    const cronJobs = [
      makeCronJob({
        enabled: false,
        state: { runCount: 5, lastStatus: "ok", lastRunAtMs: 1700000000000 },
      }),
    ];

    const result = enrichTasksWithCronData(tasks, cronJobs, "agent-1");
    expect(result).toHaveLength(1);
    expect(result[0].enabled).toBe(false);
    expect(result[0].lastRunStatus).toBe("success");
    expect(result[0].lastRunAt).toBe(new Date(1700000000000).toISOString());
  });

  it("maps error status correctly", () => {
    const tasks = [makeTask()];
    const cronJobs = [
      makeCronJob({
        state: { runCount: 1, lastStatus: "error", lastRunAtMs: 1700000000000 },
      }),
    ];

    const result = enrichTasksWithCronData(tasks, cronJobs, "agent-1");
    expect(result[0].lastRunStatus).toBe("error");
  });

  it("passes through tasks with no matching cron job", () => {
    const tasks = [makeTask({ cronJobId: "nonexistent" })];
    const result = enrichTasksWithCronData(tasks, [], "agent-1");
    expect(result).toEqual(tasks);
  });

  it("synthesizes orphan cron jobs as unmanaged tasks", () => {
    const tasks: StudioTask[] = [];
    const cronJobs = [
      makeCronJob({ id: "orphan-1", name: "Orphan Job" }),
    ];

    const result = enrichTasksWithCronData(tasks, cronJobs, "agent-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("orphan-1");
    expect(result[0].name).toBe("Orphan Job");
  });

  it("does not synthesize system jobs", () => {
    const cronJobs = [
      makeCronJob({ id: "sys:heartbeat", name: "Heartbeat" }),
    ];

    const result = enrichTasksWithCronData([], cronJobs, "agent-1");
    expect(result).toHaveLength(0);
  });

  it("does not synthesize jobs for other agents", () => {
    const cronJobs = [
      makeCronJob({ id: "other-job", agentId: "agent-2" }),
    ];

    const result = enrichTasksWithCronData([], cronJobs, "agent-1");
    expect(result).toHaveLength(0);
  });

  it("gives unnamed orphans a default name", () => {
    const cronJobs = [
      makeCronJob({ id: "orphan-1", name: "" }),
    ];

    const result = enrichTasksWithCronData([], cronJobs, "agent-1");
    expect(result[0].name).toBe("[UNMANAGED] Unknown Task");
  });
});
