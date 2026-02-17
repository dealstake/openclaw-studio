import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import {
  addCronJob,
  removeCronJob,
  runCronJobNow,
  updateCronJob,
  type CronJobSummary,
} from "@/lib/cron/types";
import type {
  CreateTaskPayload,
  StudioTask,
  UpdateTaskPayload,
} from "@/features/tasks/types";
import { taskScheduleToCronSchedule } from "@/features/tasks/lib/schedule";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateTaskId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildCronPayloadMessage(taskId: string, prompt: string): string {
  return `[TASK:${taskId}] ${prompt}`;
}

function buildDelivery(payload: CreateTaskPayload) {
  if (payload.deliveryChannel) {
    return {
      mode: "announce" as const,
      channel: payload.deliveryChannel,
      ...(payload.deliveryTarget ? { to: payload.deliveryTarget } : {}),
    };
  }
  return { mode: "announce" as const };
}

// ─── Metadata API helpers ────────────────────────────────────────────────────

async function fetchTasks(agentId: string): Promise<StudioTask[]> {
  const res = await fetch(`/api/tasks?agentId=${encodeURIComponent(agentId)}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to fetch tasks.");
  }
  const data = (await res.json()) as { tasks: StudioTask[] };
  return data.tasks ?? [];
}

async function saveTaskMetadata(task: StudioTask): Promise<void> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to save task.");
  }
}

async function patchTaskMetadata(
  agentId: string,
  taskId: string,
  patch: UpdateTaskPayload
): Promise<StudioTask> {
  const res = await fetch("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, taskId, patch }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to update task.");
  }
  const data = (await res.json()) as { task: StudioTask };
  return data.task;
}

async function deleteTaskMetadata(agentId: string, taskId: string): Promise<void> {
  const res = await fetch("/api/tasks", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, taskId }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to delete task.");
  }
}

// ─── Enrich tasks with live cron state ───────────────────────────────────────

function enrichTasksWithCronData(
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
      enabled: cron.enabled,
      lastRunAt: cron.state.lastRunAtMs
        ? new Date(cron.state.lastRunAtMs).toISOString()
        : task.lastRunAt,
      lastRunStatus:
        cron.state.lastStatus === "ok"
          ? "success"
          : cron.state.lastStatus === "error"
            ? "error"
            : task.lastRunStatus,
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
    id: job.id, // Use cron job ID as task ID
    cronJobId: job.id,
    agentId: job.agentId ?? agentId,
    name: job.name || "[UNMANAGED] Unknown Task",
    description: "This task exists in the gateway but has no Studio metadata.",
    type: "periodic", // Default fallback
    schedule: { type: "periodic", intervalMs: 3600000 }, // Dummy schedule
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
  }));

  return [...enrichedTasks, ...synthesizedTasks];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useAgentTasks = (
  client: GatewayClient,
  status: GatewayStatus,
  agentId: string | null,
  cronJobs: CronJobSummary[]
) => {
  const [tasks, setTasks] = useState<StudioTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"toggle" | "run" | "delete" | "update" | null>(null);

  const loadingRef = useRef(false);

  const loadTasks = useCallback(async () => {
    if (!agentId || status !== "connected" || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const raw = await fetchTasks(agentId);
      const enriched = enrichTasksWithCronData(raw, cronJobs, agentId);
      setTasks(enriched);
      setError(null);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message =
          err instanceof Error ? err.message : "Failed to load tasks.";
        setError(message);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [agentId, status, cronJobs]);

  const createTask = useCallback(
    async (payload: CreateTaskPayload) => {
      if (!agentId || status !== "connected") {
        throw new Error("Gateway is not connected.");
      }
      setError(null);
      const taskId = generateTaskId();
      const now = new Date().toISOString();

      try {
        // Replace {taskId} placeholders in prompt (used by templates)
        const resolvedPrompt = payload.prompt.replaceAll("{taskId}", taskId);

        // 1. Create cron job
        const cronSchedule = taskScheduleToCronSchedule(payload.schedule);
        const result = await addCronJob(client, {
          name: `[TASK] ${payload.name}`,
          schedule: cronSchedule,
          sessionTarget: "isolated",
          payload: {
            kind: "agentTurn",
            message: buildCronPayloadMessage(taskId, resolvedPrompt),
            model: payload.model,
          },
          agentId: payload.agentId,
          enabled: true,
          delivery: buildDelivery(payload),
        });

        if (!result.ok) {
          const detail = "error" in result ? (result as { error?: string }).error : "";
          throw new Error(`Gateway rejected cron job creation.${detail ? ` ${detail}` : ""}`);
        }

        // 2. Save metadata
        const task: StudioTask = {
          id: taskId,
          cronJobId: result.jobId,
          agentId: payload.agentId,
          name: payload.name,
          description: payload.description,
          type: payload.type,
          schedule: payload.schedule,
          prompt: resolvedPrompt,
          model: payload.model,
          deliveryChannel: payload.deliveryChannel ?? null,
          deliveryTarget: payload.deliveryTarget ?? null,
          enabled: true,
          createdAt: now,
          updatedAt: now,
          lastRunAt: null,
          lastRunStatus: null,
          runCount: 0,
        };

        await saveTaskMetadata(task);
        setTasks((prev) => [task, ...prev]);
        toast.success(`Task "${payload.name}" created`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create task.";
        setError(message);
        toast.error(message);
        throw err;
      }
    },
    [agentId, status, client]
  );

  const toggleTask = useCallback(
    async (taskId: string, enabled: boolean) => {
      if (!agentId || busyTaskId) return;
      setBusyTaskId(taskId);
      setBusyAction("toggle");
      setError(null);

      // Optimistic update — flip immediately, rollback on error
      const previousTasks = tasks;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, enabled } : t))
      );

      try {
        const task = previousTasks.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        await updateCronJob(client, task.cronJobId, { enabled });
        const updated = await patchTaskMetadata(agentId, taskId, { enabled });
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        toast.success(enabled ? `Task "${task.name}" resumed` : `Task "${task.name}" paused`);
      } catch (err) {
        // Rollback on failure
        setTasks(previousTasks);
        const message = err instanceof Error ? err.message : "Failed to toggle task.";
        setError(message);
        toast.error(message);
      } finally {
        setBusyTaskId(null);
        setBusyAction(null);
      }
    },
    [agentId, client, tasks, busyTaskId]
  );

  const runTask = useCallback(
    async (taskId: string) => {
      if (!agentId || busyTaskId) return;
      setBusyTaskId(taskId);
      setBusyAction("run");
      setError(null);
      try {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        await runCronJobNow(client, task.cronJobId);
        toast.success(`Task "${task.name}" triggered`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to run task.";
        setError(message);
        toast.error(message);
      } finally {
        setBusyTaskId(null);
        setBusyAction(null);
      }
    },
    [agentId, client, tasks, busyTaskId]
  );

  const updateTaskSchedule = useCallback(
    async (taskId: string, newSchedule: import("@/features/tasks/types").TaskSchedule) => {
      if (!agentId || busyTaskId) return;
      setBusyTaskId(taskId);
      setBusyAction("update");
      setError(null);
      try {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        // 1. Update the gateway cron job schedule
        const cronSchedule = taskScheduleToCronSchedule(newSchedule);
        await updateCronJob(client, task.cronJobId, { schedule: cronSchedule });

        // 2. Update Studio metadata
        const updated = await patchTaskMetadata(agentId, taskId, { schedule: newSchedule });

        // 3. Optimistically update local state
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        toast.success(`Schedule updated for "${task.name}"`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update schedule.";
        setError(message);
        toast.error(message);
      } finally {
        setBusyTaskId(null);
        setBusyAction(null);
      }
    },
    [agentId, client, tasks, busyTaskId]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: import("@/features/tasks/types").UpdateTaskPayload) => {
      if (!agentId || busyTaskId) return;
      setBusyTaskId(taskId);
      setBusyAction("update");
      setError(null);
      try {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        // If schedule changed, update the gateway cron job
        if (updates.schedule) {
          const cronSchedule = taskScheduleToCronSchedule(updates.schedule);
          await updateCronJob(client, task.cronJobId, { schedule: cronSchedule });
        }

        // If prompt or model changed, update the cron job payload
        if (updates.prompt !== undefined || updates.model !== undefined) {
          const newPrompt = updates.prompt ?? task.prompt;
          const newModel = updates.model ?? task.model;
          await updateCronJob(client, task.cronJobId, {
            payload: {
              kind: "agentTurn",
              message: buildCronPayloadMessage(task.id, newPrompt),
              model: newModel,
            },
          });
        }

        // If name changed, update the cron job name
        if (updates.name !== undefined) {
          await updateCronJob(client, task.cronJobId, {
            name: `[TASK] ${updates.name}`,
          });
        }

        // Update Studio metadata
        const updated = await patchTaskMetadata(agentId, taskId, updates);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        toast.success(`Task "${updated.name}" updated`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update task.";
        setError(message);
        toast.error(message);
      } finally {
        setBusyTaskId(null);
        setBusyAction(null);
      }
    },
    [agentId, client, tasks, busyTaskId]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!agentId || busyTaskId) return;
      setBusyTaskId(taskId);
      setBusyAction("delete");
      setError(null);
      try {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        await removeCronJob(client, task.cronJobId);
        await deleteTaskMetadata(agentId, taskId);
        const taskName = task.name;
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        toast.success(`Task "${taskName}" deleted`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete task.";
        setError(message);
        toast.error(message);
      } finally {
        setBusyTaskId(null);
        setBusyAction(null);
      }
    },
    [agentId, client, tasks, busyTaskId]
  );

  return {
    tasks,
    loading,
    error,
    busyTaskId,
    busyAction,
    loadTasks,
    createTask,
    toggleTask,
    updateTask,
    updateTaskSchedule,
    runTask,
    deleteTask,
  };
};
