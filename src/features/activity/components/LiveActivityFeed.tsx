"use client";

import { memo, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ActivityMessage } from "@/features/activity/hooks/useActivityMessageStore";
import { ActivityMessageCard } from "./ActivityMessageCard";

/** Virtualized timeline of live activity messages, auto-scrolls to new entries */
export const LiveActivityFeed = memo(function LiveActivityFeed({
  timeline,
}: {
  timeline: ActivityMessage[];
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: timeline.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  // Auto-scroll to top when new streaming entry appears
  const prevTopKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (timeline.length === 0) return;
    const topKey = timeline[0].sourceKey;
    if (prevTopKeyRef.current !== topKey) {
      prevTopKeyRef.current = topKey;
      virtualizer.scrollToIndex(0, { behavior: "smooth" });
    }
  }, [timeline, virtualizer]);

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const entry = timeline[virtualItem.index];
          return (
            <div
              key={entry.sourceKey}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              <ActivityMessageCard entry={entry} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
