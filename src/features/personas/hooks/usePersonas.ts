"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { PersonaStatus, PersonaCategory } from "../lib/personaTypes";

// ---------------------------------------------------------------------------
// Types for the UI layer
// ---------------------------------------------------------------------------

export interface PersonaListItem {
  personaId: string;
  displayName: string;
  templateKey: string | null;
  category: PersonaCategory;
  status: PersonaStatus;
  optimizationGoals: string[];
  metrics: PersonaMetricsSummary;
  createdAt: string;
  lastTrainedAt: string | null;
  practiceCount: number;
}

export interface PersonaMetricsSummary {
  sessionCount: number;
  averageScore: number;
  bestScore: number;
  trend: number;
}

export type PersonaStatusFilter = "all" | "active" | "draft" | "paused" | "archived";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function rowToItem(row: Record<string, unknown>): PersonaListItem {
  const metricsRaw = parseJson<Record<string, unknown>>(
    (row.metrics_json as string) ?? "{}",
    {},
  );
  // Support both snake_case (local Drizzle DB) and camelCase (sidecar API)
  return {
    personaId: (row.persona_id ?? row.personaId) as string,
    displayName: (row.display_name ?? row.displayName) as string,
    templateKey: ((row.template_key ?? row.templateKey) as string) ?? null,
    category: (row.category) as PersonaCategory,
    status: (row.status) as PersonaStatus,
    optimizationGoals: parseJson<string[]>(
      ((row.optimization_goals ?? row.optimizationGoals) as string) ?? "[]", [],
    ),
    metrics: {
      sessionCount: (metricsRaw.sessionCount as number) ?? 0,
      averageScore: (metricsRaw.averageScore as number) ?? 0,
      bestScore: (metricsRaw.bestScore as number) ?? 0,
      trend: (metricsRaw.trend as number) ?? 0,
    },
    createdAt: ((row.created_at ?? row.createdAt) as string),
    lastTrainedAt: ((row.last_trained_at ?? row.lastTrainedAt) as string) ?? null,
    practiceCount: ((row.practice_count ?? row.practiceCount) as number) ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePersonas(agentId: string | null, status: GatewayStatus) {
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PersonaStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    if (status !== "connected" || !agentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspace/personas?agentId=${encodeURIComponent(agentId)}`,
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { personas: Array<Record<string, unknown>> };
      setPersonas((data.personas ?? []).map(rowToItem));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load personas.");
    } finally {
      setLoading(false);
    }
  }, [agentId, status]);

  loadRef.current = load;

  useEffect(() => {
    void loadRef.current();
  }, [status, agentId]);

  const handleDelete = useCallback(
    async (personaId: string) => {
      if (!agentId) return;
      setBusyId(personaId);
      try {
        const res = await fetch(
          `/api/workspace/personas?agentId=${encodeURIComponent(agentId)}&personaId=${encodeURIComponent(personaId)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        await loadRef.current();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete persona.");
      } finally {
        setBusyId(null);
      }
    },
    [agentId],
  );

  const handleStatusChange = useCallback(
    async (personaId: string, newStatus: PersonaStatus) => {
      if (!agentId) return;
      setBusyId(personaId);
      try {
        const res = await fetch("/api/workspace/personas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, personaId, status: newStatus }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        await loadRef.current();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update persona.");
      } finally {
        setBusyId(null);
      }
    },
    [agentId],
  );

  const filtered = useMemo(() => {
    return personas.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.displayName.toLowerCase().includes(q) &&
          !p.category.toLowerCase().includes(q) &&
          !(p.templateKey ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [personas, filter, search]);

  return {
    personas: filtered,
    allPersonas: personas,
    loading,
    error,
    busyId,
    filter,
    search,
    setFilter,
    setSearch,
    reload: load,
    onDelete: handleDelete,
    onStatusChange: handleStatusChange,
  };
}
