/**
 * useMemoryGraph — fetches the extracted entity graph for an agent.
 *
 * Phase 1: data hook only. Graph rendering UI is Phase 2.
 *
 * Usage:
 *   const { data, loading, error, reload } = useMemoryGraph(agentId);
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { MemoryGraphData } from "../lib/types";

interface UseMemoryGraphResult {
  data: MemoryGraphData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useMemoryGraph(agentId: string | null): UseMemoryGraphResult {
  const [data, setData] = useState<MemoryGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref to prevent concurrent fetches (follows useAllSessions pattern)
  const loadingRef = useRef(false);
  // Track current agentId to avoid stale updates
  const agentIdRef = useRef(agentId);
  agentIdRef.current = agentId;

  const load = useCallback(async () => {
    if (!agentId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ agentId });
      const res = await fetch(`/api/memory-graph?${params.toString()}`);

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const json = (await res.json()) as MemoryGraphData;

      // Discard if agentId changed while we were fetching
      if (agentIdRef.current === agentId) {
        setData(json);
      }
    } catch (err) {
      if (agentIdRef.current === agentId) {
        setError(err instanceof Error ? err.message : "Failed to load memory graph.");
      }
    } finally {
      loadingRef.current = false;
      if (agentIdRef.current === agentId) {
        setLoading(false);
      }
    }
  }, [agentId]);

  useEffect(() => {
    if (!agentId) {
      setData(null);
      setError(null);
      return;
    }
    void load();
  }, [agentId, load]);

  return { data, loading, error, reload: load };
}
