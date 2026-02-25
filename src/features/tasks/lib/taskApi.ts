import type { StudioTask, UpdateTaskPayload } from "@/features/tasks/types";

/** Marker for errors from non-retryable HTTP responses (4xx). */
class ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientError";
  }
}

/**
 * Retry a fetch operation with exponential backoff.
 * Retries on network errors and 5xx responses (sidecar may be temporarily unavailable).
 * Does NOT retry on 4xx client errors (they will never succeed).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't retry client errors — they won't succeed
      if (err instanceof ClientError) throw err;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/** Throw a ClientError for 4xx, regular Error for 5xx (retryable). */
function throwApiError(res: Response, fallback: string, data: { error?: string }): never {
  const message = data.error ?? fallback;
  if (res.status >= 400 && res.status < 500) {
    throw new ClientError(message);
  }
  throw new Error(message);
}

export async function fetchTasks(agentId: string): Promise<StudioTask[]> {
  const res = await fetch(`/api/tasks?agentId=${encodeURIComponent(agentId)}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throwApiError(res, "Failed to fetch tasks.", data);
  }
  const data = (await res.json()) as { tasks: StudioTask[] };
  return data.tasks ?? [];
}

export async function saveTaskMetadata(task: StudioTask): Promise<void> {
  await withRetry(async () => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throwApiError(res, "Failed to save task.", data);
    }
  });
}

export async function patchTaskMetadata(
  agentId: string,
  taskId: string,
  patch: UpdateTaskPayload
): Promise<StudioTask> {
  return withRetry(async () => {
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, taskId, patch }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throwApiError(res, "Failed to update task.", data);
    }
    const data = (await res.json()) as { task: StudioTask };
    return data.task;
  });
}

export async function deleteTaskMetadata(agentId: string, taskId: string): Promise<void> {
  await withRetry(async () => {
    const res = await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, taskId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throwApiError(res, "Failed to delete task.", data);
    }
  });
}
