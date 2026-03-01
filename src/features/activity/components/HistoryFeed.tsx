"use client";

import { memo, useRef, useEffect, useCallback } from "react";
import { History, RefreshCw, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useActivityHistory } from "@/features/activity/hooks/useActivityHistory";
import { FeedbackSummary } from "@/features/feedback/components/FeedbackSummary";
import { HistoryEventCard } from "./HistoryEventCard";

/** Virtualized, paginated feed of completed activity events */
export const HistoryFeed = memo(function HistoryFeed() {
  const { events, loading, error, hasMore, loadMore, refresh } =
    useActivityHistory();
  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el || loading || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (error && events.length === 0) {
    return (
      <div className="flex-1 p-3">
        <ErrorBanner message={error} onRetry={refresh} />
      </div>
    );
  }

  if (!loading && events.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity history"
        description="Completed cron runs and agent activity will appear here"
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-end px-3 py-1">
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh history"
          className="flex min-h-[44px] items-center gap-1 rounded-md px-3 py-2 text-[10px] text-muted-foreground/80 transition-colors hover:bg-muted/60 hover:text-muted-foreground disabled:opacity-50"
        >
          <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Feedback aggregate summary — only visible when annotations exist */}
      <FeedbackSummary />

      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const event = events[virtualItem.index];
            return (
              <div
                key={event.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                <HistoryEventCard event={event} />
              </div>
            );
          })}
        </div>
        {loading && (
          <div className="flex items-center justify-center py-3">
            <Loader2 size={14} className="animate-spin text-muted-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
});
