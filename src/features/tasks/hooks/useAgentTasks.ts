import { useCallback, useRef, useState } from "react";
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
  cronJobs: CronJobSummary[]
): StudioTask[] {
  const cronMap = new Map(cronJobs.map((j) => [j.id, j]));
  return tasks.map((task) => {
    const cron = cronMap.get(task.cronJobId);
    if (!cron) return task;
    return {
      ...task,
      enabled: cron.enabled,
      lastRunAt: cron.state.lastRunAtMs
        ? new Date(cron.state.lastRunAtMs).toISOString()
        : task.lastRunAt,
      lastRunStatus: cron.state.lastStatus === "ok"
        ? "success"
        : cron.state.lastStatus === "error"
          ? "error"
          : task.lastRunStatus,
    };
  });
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

  const loadingRef = useRef(false);

  const loadTasks = useCallback(async () => {
    if (!agentId || status !== "connected" || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const raw = await fetchTasks(agentId);
      const enriched = enrichTasksWithCronData(raw, cronJobs);
      setTasks(enriched);
      setError(null);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message = err instanceof Error ? err.message : "Failed to load tasks.";
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
        // 1. Create cron job
        const cronSchedule = taskScheduleToCronSchedule(payload.schedule);
        const result = await addCronJob(client, {
          name: `[TASK] ${payload.name}`,
          schedule: cronSchedule,
          sessionTarget: "isolated",
          payload: {
            kind: "agentTurn",
            message: buildCronPayloadMessage(taskId, payload.prompt),
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
          prompt: payload.prompt,
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
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create task.";
        setError(message);
        throw err;
      }
    },
    [agentId, status, client]
  );

  const toggleTask = useCallback(
    async (taskId: string, enabled: boolean) => {
      if (!agentId || busyTaskId) return;
      setBusyTaskId(taskId);
      setError(null);
      try {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        await updateCronJob(client, task.cronJobId, { enabled });
        const updated = await patchTaskMetadata(agentId, taskId, { enabled });
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to toggle task.";
        setError(message);
      } finally {
        setBusyTaskId(null);
      }
    },
    [agentId, client, tasks, busyTaskId]
  );

  const runTask = useCallback(
    async (taskId: string) => {
      if (!agentId || busyTaskId) return;
      setBusyTaskId(taskId);
      setError(null);
      try {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        await runCronJobNow(client, task.cronJobId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to run task.";
        setError(message);
      } finally {
        setBusyTaskId(null);
      }
    },
    [agentId, client, tasks, busyTaskId]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!agentId || busyTaskId) return;
      setBusyTaskId(taskId);
      setError(null);
      try {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        await removeCronJob(client, task.cronJobId);
        await deleteTaskMetadata(agentId, taskId);
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete task.";
        setError(message);
      } finally {
        setBusyTaskId(null);
      }
    },
    [agentId, client, tasks, busyTaskId]
  );

  return {
    tasks,
    loading,
    error,
    busyTaskId,
    loadTasks,
    createTask,
    toggleTask,
    runTask,
    deleteTask,
  };
};
