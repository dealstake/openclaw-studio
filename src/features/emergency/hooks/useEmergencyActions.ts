/**
 * Hook for executing emergency actions via Gateway RPC.
 */

import { useCallback, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { listCronJobs, updateCronJob } from "@/lib/cron/types";
import type { CronJobSummary } from "@/lib/cron/types";
import type { ActionResult, ActionStatus, EmergencyActionKind } from "../lib/types";

export interface EmergencyActionsState {
  status: Record<EmergencyActionKind, ActionStatus>;
  lastResult: ActionResult | null;
  /** IDs of cron jobs that were paused (for potential restore) */
  pausedJobIds: string[];
}

const initialStatus: Record<EmergencyActionKind, ActionStatus> = {
  "pause-all-cron": "idle",
  "stop-active-sessions": "idle",
  "cleanup-zombies": "idle",
};

/**
 * Shared helper: runs a batch action with gateway check, pending state, try/catch,
 * and partial-failure reporting. Eliminates boilerplate across all three actions.
 */
async function executeBatchAction<T>(opts: {
  kind: EmergencyActionKind;
  gatewayStatus: GatewayStatus;
  setActionStatus: (kind: EmergencyActionKind, status: ActionStatus) => void;
  fetchItems: () => Promise<T[]>;
  processItem: (item: T) => Promise<void>;
  noun: string;
  pastVerb: string;
  errorMessage: string;
}): Promise<{ succeeded: number; failedCount: number; items: T[]; result: ActionResult }> {
  const { kind, gatewayStatus, setActionStatus, fetchItems, processItem, noun, pastVerb, errorMessage } = opts;

  if (gatewayStatus !== "connected") {
    return {
      succeeded: 0,
      failedCount: 0,
      items: [],
      result: { kind, status: "error", message: "Gateway not connected", affected: 0 },
    };
  }

  setActionStatus(kind, "pending");
  try {
    const items = await fetchItems();
    let succeeded = 0;
    let failedCount = 0;

    for (const item of items) {
      try {
        await processItem(item);
        succeeded++;
      } catch {
        failedCount++;
      }
    }

    const total = items.length;
    const hasFailures = failedCount > 0;
    const resultStatus = hasFailures
      ? (succeeded > 0 ? "partial" as const : "error" as const)
      : "success" as const;
    const message = hasFailures
      ? `${pastVerb} ${succeeded} of ${total} ${noun}${total === 1 ? "" : "s"}. ${failedCount} failed.`
      : `${pastVerb} ${succeeded} ${noun}${succeeded === 1 ? "" : "s"}`;

    setActionStatus(kind, resultStatus === "error" ? "error" : "success");
    const result: ActionResult = { kind, status: resultStatus, message, affected: succeeded, failed: failedCount };
    return { succeeded, failedCount, items, result };
  } catch (err) {
    if (isGatewayDisconnectLikeError(err)) throw err;
    const msg = err instanceof Error ? err.message : errorMessage;
    setActionStatus(kind, "error");
    return {
      succeeded: 0,
      failedCount: 0,
      items: [],
      result: { kind, status: "error", message: msg, affected: 0 },
    };
  }
}

export const useEmergencyActions = (client: GatewayClient, gatewayStatus: GatewayStatus) => {
  const [state, setState] = useState<EmergencyActionsState>({
    status: { ...initialStatus },
    lastResult: null,
    pausedJobIds: [],
  });

  const setActionStatus = useCallback((kind: EmergencyActionKind, status: ActionStatus) => {
    setState((prev) => ({
      ...prev,
      status: { ...prev.status, [kind]: status },
    }));
  }, []);

  const pauseAllCron = useCallback(async (): Promise<ActionResult> => {
    const pausedIds: string[] = [];
    const { result } = await executeBatchAction<CronJobSummary>({
      kind: "pause-all-cron",
      gatewayStatus,
      setActionStatus,
      fetchItems: async () => {
        const res = await listCronJobs(client, { includeDisabled: true });
        return res.jobs.filter((j: CronJobSummary) => j.enabled);
      },
      processItem: async (job) => {
        await updateCronJob(client, job.id, { enabled: false });
        pausedIds.push(job.id);
      },
      noun: "cron job",
      pastVerb: "Paused",
      errorMessage: "Failed to pause cron jobs",
    });

    setState((prev) => ({ ...prev, pausedJobIds: pausedIds, lastResult: result }));
    return result;
  }, [client, gatewayStatus, setActionStatus]);

  const stopActiveSessions = useCallback(async (): Promise<ActionResult> => {
    const { result } = await executeBatchAction<{ sessionKey: string; kind?: string }>({
      kind: "stop-active-sessions",
      gatewayStatus,
      setActionStatus,
      fetchItems: async () => {
        const res = await client.call<{ sessions: Array<{ sessionKey: string; kind?: string }> }>(
          "sessions.list",
          { activeMinutes: 30 },
        );
        return res.sessions ?? [];
      },
      processItem: async (session) => {
        await client.call("sessions.kill", { sessionKey: session.sessionKey });
      },
      noun: "session",
      pastVerb: "Stopped",
      errorMessage: "Failed to stop sessions",
    });

    setState((prev) => ({ ...prev, lastResult: result }));
    return result;
  }, [client, gatewayStatus, setActionStatus]);

  const cleanupZombies = useCallback(async (): Promise<ActionResult> => {
    const { result } = await executeBatchAction<{ sessionKey: string; lastActiveAt?: string }>({
      kind: "cleanup-zombies",
      gatewayStatus,
      setActionStatus,
      fetchItems: async () => {
        const res = await client.call<{ sessions: Array<{ sessionKey: string; lastActiveAt?: string }> }>(
          "sessions.list",
          { includeGlobal: true },
        );
        const now = Date.now();
        const thirtyMinMs = 30 * 60 * 1000;
        return (res.sessions ?? []).filter((s) => {
          if (!s.lastActiveAt) return false;
          return now - new Date(s.lastActiveAt).getTime() > thirtyMinMs;
        });
      },
      processItem: async (zombie) => {
        await client.call("sessions.kill", { sessionKey: zombie.sessionKey });
      },
      noun: "zombie session",
      pastVerb: "Cleaned up",
      errorMessage: "Failed to cleanup zombies",
    });

    setState((prev) => ({ ...prev, lastResult: result }));
    return result;
  }, [client, gatewayStatus, setActionStatus]);

  const executeAction = useCallback(
    async (kind: EmergencyActionKind): Promise<ActionResult> => {
      switch (kind) {
        case "pause-all-cron":
          return pauseAllCron();
        case "stop-active-sessions":
          return stopActiveSessions();
        case "cleanup-zombies":
          return cleanupZombies();
      }
    },
    [pauseAllCron, stopActiveSessions, cleanupZombies],
  );

  const restoreCron = useCallback(async () => {
    if (gatewayStatus !== "connected") return;
    const restored: string[] = [];
    const failed: string[] = [];
    for (const id of state.pausedJobIds) {
      try {
        await updateCronJob(client, id, { enabled: true });
        restored.push(id);
      } catch {
        failed.push(id);
      }
    }
    setState((prev) => ({
      ...prev,
      pausedJobIds: prev.pausedJobIds.filter((id) => !restored.includes(id)),
    }));
    if (failed.length > 0) {
      throw new Error(`Restored ${restored.length}, failed ${failed.length}`);
    }
  }, [client, gatewayStatus, state.pausedJobIds]);

  return {
    ...state,
    executeAction,
    restoreCron,
  };
};
