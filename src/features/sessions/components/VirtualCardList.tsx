"use client";

import { memo, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

const CARD_GAP = 8;

type VirtualCardListProps<T> = {
  items: T[];
  estimateSize: number;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  overscan?: number;
};

function VirtualCardListInner<T>({
  items,
  estimateSize,
  keyExtractor,
  renderItem,
  onLoadMore,
  loadingMore,
  overscan = 10,
}: VirtualCardListProps<T>) {
  "use no memo"; // TanStack Virtual is incompatible with React Compiler memoization
  const parentRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual: memoization handled by "use no memo"
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + CARD_GAP,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const lastItemIndex = lastItem?.index ?? -1;
  useEffect(() => {
    if (lastItemIndex < 0) return;
    if (lastItemIndex >= items.length - 5) {
      onLoadMoreRef.current?.();
    }
  }, [lastItemIndex, items.length]);

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={keyExtractor(item)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: `${CARD_GAP}px`,
              }}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
            >
              {renderItem(item)}
            </div>
          );
        })}
      </div>
      {loadingMore && (
        <div className="flex justify-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
    </div>
  );
}

export const VirtualCardList = memo(VirtualCardListInner) as typeof VirtualCardListInner;
