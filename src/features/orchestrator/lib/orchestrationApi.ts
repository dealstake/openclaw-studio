/**
 * REST API client for persisting orchestration graphs to the Studio database.
 *
 * Orchestrations are stored locally via /api/orchestrations (backed by SQLite).
 * This is separate from the gateway RPC layer (orchestrationRpc.ts) which handles
 * live execution — similar to how tasks separate metadata storage from cron execution.
 */

import type { Orchestration } from "./types";

// ─── Error helpers ────────────────────────────────────────────────────────────

/** Marker for non-retryable HTTP 4xx errors. */
class ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientError";
  }
}

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
      if (err instanceof ClientError) throw err;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

function throwApiError(
  res: Response,
  fallback: string,
  data: { error?: string },
): never {
  const message = data.error ?? fallback;
  if (res.status >= 400 && res.status < 500) throw new ClientError(message);
  throw new Error(message);
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Fetch all orchestrations for an agent. */
export async function fetchOrchestrations(agentId: string): Promise<Orchestration[]> {
  const res = await fetch(`/api/orchestrations?agentId=${encodeURIComponent(agentId)}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throwApiError(res, "Failed to fetch orchestrations.", data);
  }
  const data = (await res.json()) as { orchestrations: Orchestration[] };
  return data.orchestrations ?? [];
}

/** Create or replace an orchestration record. */
export async function saveOrchestration(orchestration: Orchestration): Promise<Orchestration> {
  return withRetry(async () => {
    const res = await fetch("/api/orchestrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orchestration }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throwApiError(res, "Failed to save orchestration.", data);
    }
    const data = (await res.json()) as { orchestration: Orchestration };
    return data.orchestration;
  });
}

/** Apply a partial update to an orchestration. */
export async function patchOrchestration(
  id: string,
  patch: Partial<Pick<Orchestration, "name" | "description" | "graph" | "status" | "lastRunAt" | "lastRunStatus" | "runCount">>,
): Promise<Orchestration> {
  return withRetry(async () => {
    const res = await fetch("/api/orchestrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throwApiError(res, "Failed to update orchestration.", data);
    }
    const data = (await res.json()) as { orchestration: Orchestration };
    return data.orchestration;
  });
}

/** Permanently delete an orchestration. */
export async function deleteOrchestrationById(id: string, agentId: string): Promise<void> {
  return withRetry(async () => {
    const res = await fetch("/api/orchestrations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, agentId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throwApiError(res, "Failed to delete orchestration.", data);
    }
  });
}
