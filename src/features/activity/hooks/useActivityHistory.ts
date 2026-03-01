"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ActivityEvent } from "@/features/activity/lib/activityTypes";
import { useAgentStore } from "@/features/agents/state/store";

const PAGE_SIZE = 50;

interface UseActivityHistoryResult {
  events: ActivityEvent[];
  total: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

/**
 * Fetches paginated activity history from `/api/activity`.
 * Auto-loads on mount, supports incremental "load more".
 */
export function useActivityHistory(): UseActivityHistoryResult {
  const { state } = useAgentStore();
  const selectedAgentId = state.selectedAgentId;
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const abortRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (offset: number, append: boolean, signal?: AbortSignal) => {
      if (loadingRef.current || !selectedAgentId) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          agentId: selectedAgentId,
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        const resp = await fetch(`/api/activity?${params}`, { signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as {
          events: ActivityEvent[];
          total: number;
        };
        setEvents((prev) => {
          if (!append) return data.events;
          // Dedup by event id to handle shifts between pages
          const existingIds = new Set(prev.map((e) => e.id));
          const newEvents = data.events.filter((e) => !existingIds.has(e.id));
          return [...prev, ...newEvents];
        });
        setTotal(data.total);
        offsetRef.current = offset + data.events.length;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [selectedAgentId],
  );

  // Initial load — abort in-flight requests when selectedAgentId changes
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    offsetRef.current = 0;
    fetchPage(0, false, controller.signal);
    return () => controller.abort();
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    fetchPage(offsetRef.current, true);
  }, [fetchPage]);

  const refresh = useCallback(() => {
    offsetRef.current = 0;
    fetchPage(0, false);
  }, [fetchPage]);

  return {
    events,
    total,
    loading,
    error,
    hasMore: events.length < total,
    loadMore,
    refresh,
  };
}
