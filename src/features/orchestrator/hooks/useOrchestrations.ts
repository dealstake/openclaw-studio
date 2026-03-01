"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type {
  Orchestration,
  OrchestrationGraph,
  OrchestrationRun,
  ParallelDispatchParams,
  ParallelDispatchResult,
} from "../lib/types";
import {
  fetchOrchestrations,
  saveOrchestration,
  patchOrchestration,
  deleteOrchestrationById,
} from "../lib/orchestrationApi";
import {
  runOrchestrationRpc,
  getOrchestrationStatusRpc,
  dispatchParallelRpc,
} from "../lib/orchestrationRpc";
import { generateOrchestrationId } from "../lib/graphValidation";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateOrchestrationPayload = {
  name: string;
  description?: string;
  agentId: string;
  graph: OrchestrationGraph;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useOrchestrations — CRUD + execution hook for orchestration graphs.
 *
 * Follows the same pattern as useAgentTasks:
 * - loadOrchestrations() fetches from local DB via REST
 * - createOrchestration / updateOrchestration / deleteOrchestration persist to DB
 * - runOrchestration / pollRunStatus call gateway RPCs
 * - dispatchParallel is the Phase 1 flat fan-out path
 */
export const useOrchestrations = (
  client: GatewayClient,
  status: GatewayStatus,
  agentId: string | null,
) => {
  const [orchestrations, setOrchestrations] = useState<Orchestration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyOrchId, setBusyOrchId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<OrchestrationRun | null>(null);

  // Stable ref guard: prevents parallel loads
  const loadingRef = useRef(false);
  const orchsRef = useRef(orchestrations);
  orchsRef.current = orchestrations;

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadOrchestrations = useCallback(async () => {
    if (!agentId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const orchs = await fetchOrchestrations(agentId);
      setOrchestrations(orchs);
      setError(null);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message = err instanceof Error ? err.message : "Failed to load orchestrations.";
        setError(message);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [agentId]);

  // ── Create ────────────────────────────────────────────────────────────────

  const createOrchestration = useCallback(
    async (payload: CreateOrchestrationPayload): Promise<Orchestration> => {
      if (!agentId) throw new Error("No agent selected.");
      const now = new Date().toISOString();
      const orchestration: Orchestration = {
        id: generateOrchestrationId(),
        name: payload.name,
        description: payload.description,
        agentId: payload.agentId,
        graph: payload.graph,
        status: "idle",
        createdAt: now,
        updatedAt: now,
        runCount: 0,
      };

      const saved = await saveOrchestration(orchestration);
      setOrchestrations((prev) => [...prev, saved]);
      return saved;
    },
    [agentId],
  );

  // ── Update ────────────────────────────────────────────────────────────────

  const updateOrchestration = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Orchestration, "name" | "description" | "graph" | "status">>,
    ): Promise<void> => {
      setBusyOrchId(id);
      try {
        const updated = await patchOrchestration(id, patch);
        setOrchestrations((prev) => prev.map((o) => (o.id === id ? updated : o)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update orchestration.";
        toast.error(message);
        throw err;
      } finally {
        setBusyOrchId(null);
      }
    },
    [],
  );

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteOrchestration = useCallback(
    async (id: string): Promise<void> => {
      if (!agentId) throw new Error("No agent selected.");
      setBusyOrchId(id);
      try {
        await deleteOrchestrationById(id, agentId);
        setOrchestrations((prev) => prev.filter((o) => o.id !== id));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete orchestration.";
        toast.error(message);
        throw err;
      } finally {
        setBusyOrchId(null);
      }
    },
    [agentId],
  );

  // ── Run ───────────────────────────────────────────────────────────────────

  const runOrchestration = useCallback(
    async (id: string, input?: string): Promise<OrchestrationRun> => {
      if (status !== "connected") throw new Error("Gateway is not connected.");
      setBusyOrchId(id);
      try {
        const result = await runOrchestrationRpc(client, { id, input });
        setActiveRun(result.run);
        // Optimistically mark as running in local state
        setOrchestrations((prev) =>
          prev.map((o) =>
            o.id === id
              ? { ...o, status: "running" as const, lastRunAt: result.run.startedAt }
              : o,
          ),
        );
        return result.run;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to run orchestration.";
        toast.error(message);
        throw err;
      } finally {
        setBusyOrchId(null);
      }
    },
    [client, status],
  );

  // ── Status polling ────────────────────────────────────────────────────────

  const pollRunStatus = useCallback(
    async (runId: string): Promise<OrchestrationRun> => {
      if (status !== "connected") throw new Error("Gateway is not connected.");
      try {
        const result = await getOrchestrationStatusRpc(client, { runId });
        setActiveRun(result.run);

        // When run completes, sync last run status to DB
        if (result.run.status !== "running") {
          const orch = orchsRef.current.find((o) => o.id === result.run.orchestrationId);
          if (orch) {
            const completedStatus = result.run.status as Orchestration["lastRunStatus"];
            void patchOrchestration(orch.id, {
              status: "idle",
              lastRunAt: result.run.startedAt,
              lastRunStatus: completedStatus,
              runCount: orch.runCount + 1,
            }).then((updated) => {
              setOrchestrations((prev) =>
                prev.map((o) => (o.id === updated.id ? updated : o)),
              );
            });
          }
        }
        return result.run;
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          console.error("[useOrchestrations] pollRunStatus error:", err);
        }
        throw err;
      }
    },
    [client, status],
  );

  // ── Parallel Dispatch (Phase 1 flat fan-out) ──────────────────────────────

  /**
   * Send the same prompt to multiple agents simultaneously.
   * Phase 1 stepping stone before full graph-based orchestration.
   */
  const dispatchParallel = useCallback(
    async (params: ParallelDispatchParams): Promise<ParallelDispatchResult> => {
      if (status !== "connected") throw new Error("Gateway is not connected.");
      return dispatchParallelRpc(client, params);
    },
    [client, status],
  );

  return {
    orchestrations,
    loading,
    error,
    busyOrchId,
    activeRun,
    loadOrchestrations,
    createOrchestration,
    updateOrchestration,
    deleteOrchestration,
    runOrchestration,
    pollRunStatus,
    dispatchParallel,
  };
};
