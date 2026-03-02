"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bot, Clock, Coins, Hash, X } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PanelIconButton } from "@/components/PanelIconButton";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { formatCost, formatTokens } from "@/lib/text/format";
import { formatDuration } from "@/lib/text/time";
import { useSessionTrace } from "../../hooks/useSessionTrace";
import { ReplayTimeline } from "./ReplayTimeline";
import { StepDetailPanel } from "./StepDetailPanel";

type ReplayViewProps = {
  agentId: string;
  sessionId: string;
  onClose: () => void;
};

export const ReplayView = React.memo(function ReplayView({
  agentId,
  sessionId,
  onClose,
}: ReplayViewProps) {
  const { turns, summary, loading, error, load } = useSessionTrace(agentId, sessionId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-select first turn when data loads
  const effectiveIndex = selectedIndex ?? (turns.length > 0 ? 0 : null);

  const selectedTurn = useMemo(
    () => (effectiveIndex != null ? (turns[effectiveIndex] ?? null) : null),
    [turns, effectiveIndex],
  );

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (turns.length === 0) return;
      const cur = effectiveIndex ?? -1;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = cur < 0 ? 0 : Math.min(cur + 1, turns.length - 1);
        setSelectedIndex(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = cur < 0 ? 0 : Math.max(cur - 1, 0);
        setSelectedIndex(prev);
      }
    },
    [onClose, turns, effectiveIndex],
  );

  useEffect(() => {
    containerRef.current?.focus();
  }, [loading]);

  if (loading && turns.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="flex h-full flex-col rounded-lg border border-border bg-card shadow-lg outline-none"
    >
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border bg-card/80 px-4 py-3">
        <div className="flex items-center justify-between">
          <SectionLabel as="h3">Session Replay</SectionLabel>
          <PanelIconButton onClick={onClose} aria-label="Close replay viewer">
            <X className="h-3.5 w-3.5" />
          </PanelIconButton>
        </div>

        {summary && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {summary.model && (
              <span className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-sans text-[10px]">
                <Bot className="h-3 w-3" />
                {summary.model}
              </span>
            )}
            <span className="flex items-center gap-1" title="Total steps">
              <Hash className="h-3 w-3" />
              {summary.totalTurns} steps
            </span>
            <span className="flex items-center gap-1" title="Total tokens">
              {formatTokens(summary.totalTokens)} tokens
            </span>
            <span className="flex items-center gap-1" title="Total cost">
              <Coins className="h-3 w-3" />
              {formatCost(summary.totalCost, "USD")}
            </span>
            {summary.totalDurationMs > 0 && (
              <span className="flex items-center gap-1" title="Total duration">
                <Clock className="h-3 w-3" />
                {formatDuration(summary.totalDurationMs)}
              </span>
            )}
            {/* Step indicator */}
            {effectiveIndex != null && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                Step {effectiveIndex + 1} / {turns.length}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 pt-2">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Timeline */}
        <div
          className="min-h-0 flex-1 border-b border-border md:max-w-[45%] md:border-b-0 md:border-r"
          aria-label="Replay timeline"
        >
          <ReplayTimeline
            turns={turns}
            selectedIndex={effectiveIndex}
            onSelect={handleSelect}
          />
        </div>

        {/* Detail pane */}
        <div className="min-h-0 flex-1 overflow-auto">
          <StepDetailPanel
            turn={selectedTurn}
            stepNumber={effectiveIndex}
            loading={loading && !selectedTurn}
          />
        </div>
      </div>
    </div>
  );
});
