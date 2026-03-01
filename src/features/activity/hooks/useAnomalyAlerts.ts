"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAgentStore } from "@/features/agents/state/store";
import type { AgentAnomaly } from "@/features/activity/lib/anomalyTypes";

interface UseAnomalyAlertsResult {
  anomalies: AgentAnomaly[];
  activeCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  dismissOne: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
}

/**
 * Fetches recent anomaly alerts for the selected agent from
 * GET /api/activity/alerts.
 *
 * Auto-loads on mount and on agent change.
 * Exposes dismiss helpers that optimistically update local state.
 */
export function useAnomalyAlerts(): UseAnomalyAlertsResult {
  const { state } = useAgentStore();
  const selectedAgentId = state.selectedAgentId;

  const [anomalies, setAnomalies] = useState<AgentAnomaly[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAlerts = useCallback(
    async (agentId: string, signal?: AbortSignal) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          agentId,
          days: "30",
          includeAll: "false",
          limit: "100",
        });
        const resp = await fetch(`/api/activity/alerts?${params.toString()}`, { signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as {
          anomalies: AgentAnomaly[];
          activeCount: number;
        };
        setAnomalies(data.anomalies);
        setActiveCount(data.activeCount);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load alerts");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    []
  );

  const refresh = useCallback(() => {
    if (!selectedAgentId) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    void fetchAlerts(selectedAgentId, abortRef.current.signal);
  }, [selectedAgentId, fetchAlerts]);

  useEffect(() => {
    if (!selectedAgentId) {
      setAnomalies([]);
      setActiveCount(0);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    void fetchAlerts(selectedAgentId, abortRef.current.signal);
    return () => {
      abortRef.current?.abort();
    };
  }, [selectedAgentId, fetchAlerts]);

  const dismissOne = useCallback(
    async (id: string) => {
      if (!selectedAgentId) return;
      // Optimistic update
      setAnomalies((prev) => prev.filter((a) => a.id !== id));
      setActiveCount((prev) => Math.max(0, prev - 1));
      try {
        await fetch(`/api/activity/alerts?agentId=${encodeURIComponent(selectedAgentId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch {
        // Revert on error by refreshing
        refresh();
      }
    },
    [selectedAgentId, refresh]
  );

  const dismissAll = useCallback(async () => {
    if (!selectedAgentId) return;
    const snapshot = anomalies;
    // Optimistic update
    setAnomalies([]);
    setActiveCount(0);
    try {
      await fetch(`/api/activity/alerts?agentId=${encodeURIComponent(selectedAgentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissAll: true }),
      });
    } catch {
      // Revert on error
      setAnomalies(snapshot);
      setActiveCount(snapshot.length);
    }
  }, [selectedAgentId, anomalies]);

  return { anomalies, activeCount, loading, error, refresh, dismissOne, dismissAll };
}
