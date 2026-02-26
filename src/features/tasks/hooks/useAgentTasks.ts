import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import {
  addCronJob,
  listCronJobs,
  removeCronJob,
  runCronJobNow,
  updateCronJob,
} from "@/lib/cron/types";
import type {
  CreateTaskPayload,
  StudioTask,
  UpdateTaskPayload,
} from "@/features/tasks/types";
import { taskScheduleToCronSchedule } from "@/features/tasks/lib/schedule";
import { fetchTasks, saveTaskMetadata, patchTaskMetadata, deleteTaskMetadata } from "@/features/tasks/lib/taskApi";
import { generateTaskId, buildCronPayloadMessage, buildDelivery, enrichTasksWithCronData } from "@/features/tasks/lib/taskEnrichment";

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useAgentTasks = (
  client: GatewayClient,
  status: GatewayStatus,
  agentId: string | null,
) => {
  const [tasks, setTasks] = useState<StudioTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"toggle" | "run" | "delete" | "update" | null>(null);

  const loadingRef = useRef(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const busyTaskIdRef = useRef(busyTaskId);
  busyTaskIdRef.current = busyTaskId;

  const loadTasks = useCallback(async () => {
    if (!agentId || status !== "connected" || loadingRef.current || busyTaskIdRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      // Single-pass: fetch DB metadata + gateway cron jobs in parallel, then enrich
      const [raw, cronResult] = await Promise.all([
        fetchTasks(agentId),
        listCronJobs(client, { includeDisabled: true }),
      ]);
      const enriched = enrichTasksWithCronData(raw, cronResult.jobs, agentId);

      // Auto-import: persist any newly-discovered cron jobs (id === cronJobId means no DB record yet)
      const needsImport = enriched.filter((t) => t.id === t.cronJobId && t.managementStatus !== "orphan");
      if (needsImport.length > 0) {
        const imported = await Promise.allSettled(
          needsImport.map(async (t) => {
            const newId = generateTaskId();
            const now = new Date().toISOString();
            const managed: StudioTask = {
              ...t,
              id: newId,
              createdAt: now,
              updatedAt: now,
            };
            await saveTaskMetadata(managed);
            return { oldId: t.id, managed };
          })
        );
        const importMap = new Map<string, StudioTask>();
        for (const result of imported) {
          if (result.status === "fulfilled") {
            importMap.set(result.value.oldId, result.value.managed);
          }
        }
        const finalTasks = enriched.map((t) => importMap.get(t.id) ?? t);
        setTasks(finalTasks);
      } else {
        setTasks(enriched);
      }
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
  }, [agentId, status, client]);

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
            ...(payload.thinking ? { thinking: payload.thinking } : {}),
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
          managementStatus: "managed",
          name: payload.name,
          description: payload.description,
          type: payload.type,
          schedule: payload.schedule,
          prompt: resolvedPrompt,
          model: payload.model,
          thinking: payload.thinking ?? null,
          deliveryChannel: payload.deliveryChannel ?? null,
          deliveryTarget: payload.deliveryTarget ?? null,
          enabled: true,
          createdAt: now,
          updatedAt: now,
          lastRunAt: null,
          lastRunStatus: null,
          runCount: 0,
        };

        try {
          await saveTaskMetadata(task);
        } catch (dbErr) {
          // Cron job was created but DB write failed — clean up orphaned cron job
          console.warn("Task metadata save failed, removing orphaned cron job", result.jobId, dbErr);
          try {
            await removeCronJob(client, result.jobId);
          } catch {
            // If cleanup also fails, warn — orphan cron job exists
            console.error("Failed to remove orphaned cron job:", result.jobId);
            toast.error(`Task created in gateway but metadata save failed. Orphaned cron job: ${result.jobId}`);
          }
          throw dbErr;
        }
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
      if (!agentId || busyTaskIdRef.current) return;
      setBusyTaskId(taskId);
      setBusyAction("toggle");
      setError(null);

      // Optimistic update — flip immediately, rollback on error
      const previousTasks = tasksRef.current;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, enabled } : t))
      );

      try {
        const task = previousTasks.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        // Only update cron — enabled state is cron-owned, enriched at read time
        await updateCronJob(client, task.cronJobId, { enabled });
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
    [agentId, client]
  );

  const runTask = useCallback(
    async (taskId: string) => {
      if (!agentId || busyTaskIdRef.current) return;
      setBusyTaskId(taskId);
      setBusyAction("run");
      setError(null);
      try {
        const task = tasksRef.current.find((t) => t.id === taskId);
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
    [agentId, client]
  );

  const updateTaskSchedule = useCallback(
    async (taskId: string, newSchedule: import("@/features/tasks/types").TaskSchedule) => {
      if (!agentId || busyTaskIdRef.current) return;
      setBusyTaskId(taskId);
      setBusyAction("update");
      setError(null);
      try {
        const task = tasksRef.current.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        // Update gateway cron only — schedule is cron-owned, enriched at read time
        const cronSchedule = taskScheduleToCronSchedule(newSchedule);
        await updateCronJob(client, task.cronJobId, { schedule: cronSchedule });

        // Optimistically update local state (will be confirmed on next enrichment)
        setTasks((prev) => prev.map((t) =>
          t.id === taskId ? { ...t, schedule: newSchedule } : t
        ));
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
    [agentId, client]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: UpdateTaskPayload) => {
      if (!agentId || busyTaskIdRef.current) return;
      setBusyTaskId(taskId);
      setBusyAction("update");
      setError(null);
      try {
        const task = tasksRef.current.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        // Build a single cron patch for cron-relevant fields (name, prompt, model)
        // Schedule changes go through updateTaskSchedule(); enabled through toggleTask()
        const cronPatch: Record<string, unknown> = {};

        if (updates.prompt !== undefined || updates.model !== undefined || updates.thinking !== undefined) {
          const newPrompt = updates.prompt ?? task.prompt;
          const newModel = updates.model ?? task.model;
          const newThinking = updates.thinking !== undefined ? updates.thinking : task.thinking;
          cronPatch.payload = {
            kind: "agentTurn",
            message: buildCronPayloadMessage(task.id, newPrompt),
            model: newModel,
            ...(newThinking ? { thinking: newThinking } : {}),
          };
        }

        // Delivery changes go to cron
        if (updates.deliveryChannel !== undefined || updates.deliveryTarget !== undefined) {
          const channel = updates.deliveryChannel !== undefined ? updates.deliveryChannel : task.deliveryChannel;
          const to = updates.deliveryTarget !== undefined ? updates.deliveryTarget : task.deliveryTarget;
          cronPatch.delivery = {
            mode: channel ? "announce" : "none",
            ...(channel ? { channel } : {}),
            ...(to ? { to } : {}),
          };
        }

        if (updates.name !== undefined) {
          cronPatch.name = `[TASK] ${updates.name}`;
        }

        // Single RPC call instead of up to 3 sequential calls
        if (Object.keys(cronPatch).length > 0) {
          await updateCronJob(client, task.cronJobId, cronPatch);
        }

        // Update Studio metadata
        const updated = await patchTaskMetadata(agentId, taskId, updates);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...updated, managementStatus: t.managementStatus } : t)));
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
    [agentId, client]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!agentId || busyTaskIdRef.current) return;
      setBusyTaskId(taskId);
      setBusyAction("delete");
      setError(null);
      try {
        const task = tasksRef.current.find((t) => t.id === taskId);
        if (!task) throw new Error("Task not found.");

        const isOrphan = task.managementStatus === "orphan";
        // For orphans (DB-only), skip cron removal — the cron job doesn't exist
        if (!isOrphan) {
          await removeCronJob(client, task.cronJobId);
        }

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
    [agentId, client]
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
