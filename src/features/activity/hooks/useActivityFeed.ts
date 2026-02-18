import { useCallback, useRef, useState } from "react";
import type { ActivityEvent, ActivityFilter } from "../lib/activityTypes";

interface ActivityFeedResult {
  events: ActivityEvent[];
  total: number;
}

const PAGE_SIZE = 50;

export const useActivityFeed = (agentId: string | null, filters?: ActivityFilter) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const loadingRef = useRef(false);

  const loadEvents = useCallback(
    async (reset?: boolean) => {
      if (!agentId || loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      const currentOffset = reset ? 0 : offset;
      try {
        const params = new URLSearchParams({
          agentId,
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
        });
        if (filters?.types?.length === 1) params.set("type", filters.types[0]);
        if (filters?.taskId) params.set("taskId", filters.taskId);
        if (filters?.projectSlug) params.set("projectSlug", filters.projectSlug);
        if (filters?.status) params.set("status", filters.status);

        const res = await fetch(`/api/activity?${params.toString()}`);
        if (!res.ok) throw new Error(`Activity API error: ${res.status}`);
        const data: ActivityFeedResult = await res.json();

        if (reset) {
          setEvents(data.events);
          setOffset(data.events.length);
        } else {
          setEvents((prev) => [...prev, ...data.events]);
          setOffset(currentOffset + data.events.length);
        }
        setTotal(data.total);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load activity.";
        setError(message);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [agentId, offset, filters]
  );

  const refresh = useCallback(() => loadEvents(true), [loadEvents]);
  const loadMore = useCallback(() => loadEvents(false), [loadEvents]);
  const hasMore = events.length < total;

  return { events, loading, error, refresh, loadMore, hasMore, total };
};
