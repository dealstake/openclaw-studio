"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { useSessionTrace } from "../../hooks/useSessionTrace";
import { TraceHeader } from "./TraceHeader";
import { TraceTurnRow } from "./TraceTurnRow";
import { TraceTurnDetail } from "./TraceTurnDetail";

type TraceViewerProps = {
  agentId: string;
  sessionId: string;
  onClose: () => void;
};

export const TraceViewer = React.memo(function TraceViewer({
  agentId,
  sessionId,
  onClose,
}: TraceViewerProps) {
  const {
    turns,
    summary,
    loading,
    error,
    selectedTurnIndex,
    setSelectedTurnIndex,
    load,
  } = useSessionTrace(agentId, sessionId);

  const listRef = useRef<HTMLDivElement>(null);

  // Auto-load on mount
  useEffect(() => {
    load();
  }, [load]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual: memoization handled by "use no memo"
  const virtualizer = useVirtualizer({
    count: turns.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const maxLatency = useMemo(
    () => turns.reduce((max, t) => (t.latencyMs && t.latencyMs > max ? t.latencyMs : max), 0),
    [turns],
  );

  const selectedTurn =
    selectedTurnIndex !== null && selectedTurnIndex < turns.length
      ? turns[selectedTurnIndex]
      : null;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (turns.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedTurnIndex((prev) =>
          prev === null ? 0 : Math.min(prev + 1, turns.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedTurnIndex((prev) =>
          prev === null ? 0 : Math.max(prev - 1, 0),
        );
      }
    },
    [onClose, turns.length, setSelectedTurnIndex],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading && turns.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-lg">
      {summary && <TraceHeader summary={summary} onClose={onClose} />}

      {error && (
        <div className="px-4 pt-2">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}

      {/* Two-column layout: turn list (left) + detail (right) */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Turn list */}
        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-auto border-b border-border md:max-w-[45%] md:border-b-0 md:border-r"
          role="listbox"
          aria-label="Trace turns"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((vItem) => {
              const turn = turns[vItem.index];
              return (
                <div
                  key={vItem.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vItem.start}px)`,
                  }}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                >
                  <TraceTurnRow
                    turn={turn}
                    isSelected={selectedTurnIndex === vItem.index}
                    maxLatency={maxLatency}
                    onSelect={setSelectedTurnIndex}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail pane */}
        <div className="min-h-0 flex-1 overflow-auto">
          <TraceTurnDetail turn={selectedTurn} loading={loading} />
        </div>
      </div>
    </div>
  );
});
