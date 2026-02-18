import type { StudioTask, UpdateTaskPayload } from "@/features/tasks/types";

export async function fetchTasks(agentId: string): Promise<StudioTask[]> {
  const res = await fetch(`/api/tasks?agentId=${encodeURIComponent(agentId)}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to fetch tasks.");
  }
  const data = (await res.json()) as { tasks: StudioTask[] };
  return data.tasks ?? [];
}

export async function saveTaskMetadata(task: StudioTask): Promise<void> {
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

export async function patchTaskMetadata(
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

export async function deleteTaskMetadata(agentId: string, taskId: string): Promise<void> {
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
