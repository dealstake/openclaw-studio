import type { CronJobSummary } from "@/lib/cron/types";
import type { CreateTaskPayload, StudioTask } from "@/features/tasks/types";
import { cronScheduleToTaskSchedule } from "@/features/tasks/lib/schedule";

export function generateTaskId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildCronPayloadMessage(taskId: string, prompt: string): string {
  return `[TASK:${taskId}] ${prompt}`;
}

export function buildDelivery(payload: CreateTaskPayload) {
  if (payload.deliveryChannel) {
    return {
      mode: "announce" as const,
      channel: payload.deliveryChannel,
      ...(payload.deliveryTarget ? { to: payload.deliveryTarget } : {}),
    };
  }
  return { mode: "announce" as const };
}

export function enrichTasksWithCronData(
  tasks: StudioTask[],
  cronJobs: CronJobSummary[],
  agentId: string
): StudioTask[] {
  const cronMap = new Map(cronJobs.map((j) => [j.id, j]));
  const knownCronJobIds = new Set(tasks.map((t) => t.cronJobId));

  const enrichedTasks = tasks.map((task) => {
    const cron = cronMap.get(task.cronJobId);
    if (!cron) return task;
    return {
      ...task,
      // Cron is authoritative for all runtime state
      enabled: cron.enabled,
      schedule: cronScheduleToTaskSchedule(cron.schedule, task.type),
      lastRunAt: cron.state.lastRunAtMs
        ? new Date(cron.state.lastRunAtMs).toISOString()
        : task.lastRunAt,
      lastRunStatus:
        cron.state.lastStatus === "ok"
          ? "success"
          : cron.state.lastStatus === "error"
            ? "error"
            : task.lastRunStatus,
      runCount: cron.state.runCount ?? task.runCount,
      nextRunAtMs: cron.state.nextRunAtMs,
      runningAtMs: cron.state.runningAtMs,
      lastDurationMs: cron.state.lastDurationMs,
      consecutiveErrors: cron.state.consecutiveErrors ?? (cron.state.lastStatus === "error" ? 1 : 0),
    };
  });

  // Identify orphan cron jobs (jobs for this agent but not in tasks list)
  const orphanJobs = cronJobs.filter(
    (job) =>
      job.agentId === agentId &&
      !knownCronJobIds.has(job.id) &&
      !job.id.startsWith("sys:") // Ignore system jobs if any
  );

  const synthesizedTasks: StudioTask[] = orphanJobs.map((job) => ({
    id: job.id,
    cronJobId: job.id,
    agentId: job.agentId ?? agentId,
    name: job.name || "[UNMANAGED] Unknown Task",
    description: "This task exists in the gateway but has no Studio metadata.",
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 3600000 },
    prompt:
      job.payload.kind === "agentTurn"
        ? job.payload.message
        : job.payload.kind === "systemEvent"
          ? job.payload.text
          : JSON.stringify(job.payload),
    model:
      job.payload.kind === "agentTurn" ? job.payload.model ?? "default" : "default",
    deliveryChannel: null,
    deliveryTarget: null,
    enabled: job.enabled,
    createdAt: new Date(job.createdAtMs ?? Date.now()).toISOString(),
    updatedAt: new Date(job.createdAtMs ?? Date.now()).toISOString(),
    lastRunAt: job.state.lastRunAtMs
      ? new Date(job.state.lastRunAtMs).toISOString()
      : null,
    lastRunStatus:
      job.state.lastStatus === "ok"
        ? "success"
        : job.state.lastStatus === "error"
          ? "error"
          : null,
    runCount: job.state.runCount ?? 0,
    nextRunAtMs: job.state.nextRunAtMs,
    runningAtMs: job.state.runningAtMs,
    lastDurationMs: job.state.lastDurationMs,
    consecutiveErrors: 0,
  }));

  return [...enrichedTasks, ...synthesizedTasks];
}
