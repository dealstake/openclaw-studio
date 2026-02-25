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
    if (gatewayStatus !== "connected") {
      return { kind: "pause-all-cron", status: "error", message: "Gateway not connected", affected: 0 };
    }
    setActionStatus("pause-all-cron", "pending");
    try {
      const result = await listCronJobs(client, { includeDisabled: true });
      const enabledJobs = result.jobs.filter((j: CronJobSummary) => j.enabled);
      const pausedIds: string[] = [];

      for (const job of enabledJobs) {
        try {
          await updateCronJob(client, job.id, { enabled: false });
          pausedIds.push(job.id);
        } catch {
          // Continue with remaining jobs
        }
      }

      setState((prev) => ({
        ...prev,
        status: { ...prev.status, "pause-all-cron": "success" },
        pausedJobIds: pausedIds,
        lastResult: {
          kind: "pause-all-cron",
          status: "success",
          message: `Paused ${pausedIds.length} cron job${pausedIds.length === 1 ? "" : "s"}`,
          affected: pausedIds.length,
        },
      }));
      return { kind: "pause-all-cron", status: "success", message: `Paused ${pausedIds.length} cron job${pausedIds.length === 1 ? "" : "s"}`, affected: pausedIds.length };
    } catch (err) {
      if (isGatewayDisconnectLikeError(err)) throw err;
      const msg = err instanceof Error ? err.message : "Failed to pause cron jobs";
      setActionStatus("pause-all-cron", "error");
      return { kind: "pause-all-cron", status: "error", message: msg, affected: 0 };
    }
  }, [client, gatewayStatus, setActionStatus]);

  const stopActiveSessions = useCallback(async (): Promise<ActionResult> => {
    if (gatewayStatus !== "connected") {
      return { kind: "stop-active-sessions", status: "error", message: "Gateway not connected", affected: 0 };
    }
    setActionStatus("stop-active-sessions", "pending");
    try {
      const result = await client.call<{ sessions: Array<{ sessionKey: string; kind?: string }> }>(
        "sessions.list",
        { activeMinutes: 30 }
      );
      const activeSessions = result.sessions ?? [];
      let stopped = 0;

      for (const session of activeSessions) {
        try {
          await client.call("sessions.kill", { sessionKey: session.sessionKey });
          stopped++;
        } catch {
          // Continue with remaining sessions
        }
      }

      setActionStatus("stop-active-sessions", "success");
      const res: ActionResult = {
        kind: "stop-active-sessions",
        status: "success",
        message: `Stopped ${stopped} session${stopped === 1 ? "" : "s"}`,
        affected: stopped,
      };
      setState((prev) => ({ ...prev, lastResult: res }));
      return res;
    } catch (err) {
      if (isGatewayDisconnectLikeError(err)) throw err;
      const msg = err instanceof Error ? err.message : "Failed to stop sessions";
      setActionStatus("stop-active-sessions", "error");
      return { kind: "stop-active-sessions", status: "error", message: msg, affected: 0 };
    }
  }, [client, gatewayStatus, setActionStatus]);

  const cleanupZombies = useCallback(async (): Promise<ActionResult> => {
    if (gatewayStatus !== "connected") {
      return { kind: "cleanup-zombies", status: "error", message: "Gateway not connected", affected: 0 };
    }
    setActionStatus("cleanup-zombies", "pending");
    try {
      const result = await client.call<{ sessions: Array<{ sessionKey: string; lastActiveAt?: string }> }>(
        "sessions.list",
        { includeGlobal: true }
      );
      const now = Date.now();
      const thirtyMinMs = 30 * 60 * 1000;
      const zombies = (result.sessions ?? []).filter((s) => {
        if (!s.lastActiveAt) return false;
        return now - new Date(s.lastActiveAt).getTime() > thirtyMinMs;
      });

      let cleaned = 0;
      for (const zombie of zombies) {
        try {
          await client.call("sessions.kill", { sessionKey: zombie.sessionKey });
          cleaned++;
        } catch {
          // Continue
        }
      }

      setActionStatus("cleanup-zombies", "success");
      const res: ActionResult = {
        kind: "cleanup-zombies",
        status: "success",
        message: `Cleaned up ${cleaned} zombie session${cleaned === 1 ? "" : "s"}`,
        affected: cleaned,
      };
      setState((prev) => ({ ...prev, lastResult: res }));
      return res;
    } catch (err) {
      if (isGatewayDisconnectLikeError(err)) throw err;
      const msg = err instanceof Error ? err.message : "Failed to cleanup zombies";
      setActionStatus("cleanup-zombies", "error");
      return { kind: "cleanup-zombies", status: "error", message: msg, affected: 0 };
    }
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
    [pauseAllCron, stopActiveSessions, cleanupZombies]
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
    // Only remove successfully restored IDs; keep failed ones for retry
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
