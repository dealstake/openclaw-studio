import { describe, it, expect } from "vitest";
import {
  enrichTasksWithCronData,
  generateTaskId,
  buildCronPayloadMessage,
  buildDelivery,
} from "@/features/tasks/lib/taskEnrichment";
import type { StudioTask } from "@/features/tasks/types";
import type { CronJobSummary } from "@/lib/cron/cron-types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const AGENT_ID = "agent-test-001";

function makeCronJob(overrides: Partial<CronJobSummary> = {}): CronJobSummary {
  return {
    id: "cron-001",
    name: "[TASK] Test Task",
    agentId: AGENT_ID,
    enabled: true,
    createdAtMs: 1700000000000,
    updatedAtMs: 1700000000000,
    schedule: { kind: "every", everyMs: 900000 },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: { kind: "agentTurn", message: "[TASK:task-001] Do stuff", model: "sonnet" },
    state: {
      lastRunAtMs: 1700000060000,
      lastStatus: "ok",
      runCount: 5,
      nextRunAtMs: 1700000120000,
    },
    ...overrides,
  };
}

function makeTask(overrides: Partial<StudioTask> = {}): StudioTask {
  return {
    id: "task-001",
    cronJobId: "cron-001",
    agentId: AGENT_ID,
    managementStatus: "managed",
    name: "Test Task",
    description: "A test task",
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 900000 },
    prompt: "Do stuff",
    model: "default",
    thinking: null,
    deliveryChannel: null,
    deliveryTarget: null,
    enabled: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("enrichTasksWithCronData", () => {
  it("enriches managed tasks with cron runtime state", () => {
    const tasks = [makeTask()];
    const cronJobs = [makeCronJob()];
    const result = enrichTasksWithCronData(tasks, cronJobs, AGENT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].managementStatus).toBe("managed");
    // Cron is authoritative — overrides local state
    expect(result[0].enabled).toBe(true);
    expect(result[0].model).toBe("sonnet");
    expect(result[0].lastRunStatus).toBe("success");
    expect(result[0].runCount).toBe(5);
    expect(result[0].nextRunAtMs).toBe(1700000120000);
  });

  it("marks tasks as orphan when cron job is missing", () => {
    const tasks = [makeTask({ cronJobId: "cron-missing" })];
    const result = enrichTasksWithCronData(tasks, [], AGENT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].managementStatus).toBe("orphan");
    expect(result[0].rawCronJob).toBeUndefined();
  });

  it("synthesizes unmanaged tasks from cron jobs not in DB", () => {
    const cronJobs = [makeCronJob({ id: "cron-unmanaged", name: "Raw CLI Job" })];
    const result = enrichTasksWithCronData([], cronJobs, AGENT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].managementStatus).toBe("unmanaged");
    expect(result[0].cronJobId).toBe("cron-unmanaged");
    expect(result[0].name).toBe("Raw CLI Job");
  });

  it("strips [TASK] prefix from unmanaged job names", () => {
    const cronJobs = [makeCronJob({ id: "cron-x", name: "[TASK] Prefixed Job" })];
    const result = enrichTasksWithCronData([], cronJobs, AGENT_ID);

    expect(result[0].name).toBe("Prefixed Job");
  });

  it("ignores cron jobs for other agents", () => {
    const cronJobs = [makeCronJob({ id: "cron-other", agentId: "agent-other" })];
    const result = enrichTasksWithCronData([], cronJobs, AGENT_ID);

    expect(result).toHaveLength(0);
  });

  it("ignores system cron jobs (sys: prefix)", () => {
    const cronJobs = [makeCronJob({ id: "sys:heartbeat", agentId: AGENT_ID })];
    const result = enrichTasksWithCronData([], cronJobs, AGENT_ID);

    expect(result).toHaveLength(0);
  });

  it("returns all three categories together", () => {
    const tasks = [
      makeTask({ id: "t1", cronJobId: "cron-001" }),
      makeTask({ id: "t2", cronJobId: "cron-gone" }),
    ];
    const cronJobs = [
      makeCronJob({ id: "cron-001" }),
      makeCronJob({ id: "cron-orphan", name: "Orphan Job", agentId: AGENT_ID }),
    ];
    const result = enrichTasksWithCronData(tasks, cronJobs, AGENT_ID);

    const managed = result.filter((t) => t.managementStatus === "managed");
    const orphans = result.filter((t) => t.managementStatus === "orphan");
    const unmanaged = result.filter((t) => t.managementStatus === "unmanaged");

    expect(managed).toHaveLength(1);
    expect(orphans).toHaveLength(1);
    expect(unmanaged).toHaveLength(1);
  });

  it("reads thinking from cron payload", () => {
    const cronJobs = [makeCronJob({
      payload: { kind: "agentTurn", message: "[TASK:task-001] Do stuff", model: "sonnet", thinking: "low" },
    })];
    const result = enrichTasksWithCronData([makeTask()], cronJobs, AGENT_ID);

    expect(result[0].thinking).toBe("low");
  });

  it("reads delivery from cron", () => {
    const cronJobs = [makeCronJob({
      delivery: { mode: "announce", channel: "telegram", to: "-100123" },
    })];
    const result = enrichTasksWithCronData([makeTask()], cronJobs, AGENT_ID);

    expect(result[0].deliveryChannel).toBe("telegram");
    expect(result[0].deliveryTarget).toBe("-100123");
  });

  it("maps cron lastStatus=error to lastRunStatus=error", () => {
    const cronJobs = [makeCronJob({
      state: { lastStatus: "error", lastRunAtMs: 1700000060000, runCount: 3 },
    })];
    const result = enrichTasksWithCronData([makeTask()], cronJobs, AGENT_ID);

    expect(result[0].lastRunStatus).toBe("error");
  });
});

describe("generateTaskId", () => {
  it("produces unique IDs with task- prefix", () => {
    const a = generateTaskId();
    const b = generateTaskId();
    expect(a).toMatch(/^task-/);
    expect(b).toMatch(/^task-/);
    expect(a).not.toBe(b);
  });
});

describe("buildCronPayloadMessage", () => {
  it("wraps prompt with [TASK:id] prefix", () => {
    const msg = buildCronPayloadMessage("task-abc", "Do the thing");
    expect(msg).toBe("[TASK:task-abc] Do the thing");
  });
});

describe("buildDelivery", () => {
  it("returns announce mode with channel", () => {
    const result = buildDelivery({
      deliveryChannel: "telegram",
      deliveryTarget: "-100123",
    } as Parameters<typeof buildDelivery>[0]);
    expect(result).toEqual({ mode: "announce", channel: "telegram", to: "-100123" });
  });

  it("returns announce mode without channel", () => {
    const result = buildDelivery({} as Parameters<typeof buildDelivery>[0]);
    expect(result).toEqual({ mode: "announce" });
  });
});
