"use client";

import { memo, useCallback, useState } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { VirtualCardList } from "@/features/sessions/components/VirtualCardList";
import type { DisplayEvent } from "../lib/activityTypes";
import { ActivityCard } from "./ActivityCard";

export const ActivityFeed = memo(function ActivityFeed({
  events,
  loading,
  error,
  onRefresh,
  onLoadMore,
  hasMore,
}: {
  events: DisplayEvent[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (error) {
    return <ErrorBanner message={error} onRetry={onRefresh} className="mx-3 mt-2" />;
  }

  if (loading && events.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-3 pt-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground">
        No activity yet — cron agents will report here.
      </div>
    );
  }

  return (
    <div role="log" aria-live="polite" className="flex-1 min-h-0">
      <VirtualCardList
        items={events}
        estimateSize={56}
        keyExtractor={(e) => e.id}
        renderItem={(e) => (
          <ActivityCard
            event={e}
            isExpanded={expandedIds.has(e.id)}
            onToggle={() => toggleExpand(e.id)}
          />
        )}
        onLoadMore={hasMore ? onLoadMore : undefined}
        loadingMore={loading && events.length > 0}
      />
    </div>
  );
});
