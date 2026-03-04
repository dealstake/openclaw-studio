"use client";

import { memo, useState } from "react";
import { ThumbsUp, ThumbsDown, Flag, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllAnnotations } from "../hooks/useAllAnnotations";
import type { AgentFeedbackStats } from "../hooks/useAllAnnotations";

// ── Sub-components ─────────────────────────────────────────────────────

const RatioBar = memo(function RatioBar({
  thumbsUp,
  thumbsDown,
}: {
  thumbsUp: number;
  thumbsDown: number;
}) {
  const total = thumbsUp + thumbsDown;
  if (total === 0) return null;
  const upPct = Math.round((thumbsUp / total) * 100);
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full bg-muted"
      aria-label={`${upPct}% positive feedback`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={upPct}
    >
      <div
        className="h-full rounded-full bg-emerald-500/70 transition-all"
        style={{ width: `${upPct}%` }}
      />
    </div>
  );
});

const AgentRow = memo(function AgentRow({ stats }: { stats: AgentFeedbackStats }) {
  const positiveRate =
    stats.thumbsUp + stats.thumbsDown > 0
      ? Math.round(
          (stats.thumbsUp / (stats.thumbsUp + stats.thumbsDown)) * 100,
        )
      : null;

  return (
    <div className="flex flex-col gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-foreground capitalize">
          {stats.agentId}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {stats.thumbsUp > 0 && (
            <span className="flex items-center gap-0.5 text-emerald-500/80">
              <ThumbsUp className="h-2.5 w-2.5" />
              {stats.thumbsUp}
            </span>
          )}
          {stats.thumbsDown > 0 && (
            <span className="flex items-center gap-0.5 text-rose-500/80">
              <ThumbsDown className="h-2.5 w-2.5" />
              {stats.thumbsDown}
            </span>
          )}
          {stats.flags > 0 && (
            <span className="flex items-center gap-0.5 text-amber-500/80">
              <Flag className="h-2.5 w-2.5" />
              {stats.flags}
            </span>
          )}
          {positiveRate !== null && (
            <span className="tabular-nums text-muted-foreground/60">
              {positiveRate}%
            </span>
          )}
        </div>
      </div>
      <RatioBar thumbsUp={stats.thumbsUp} thumbsDown={stats.thumbsDown} />
    </div>
  );
});

// ── Main Component ─────────────────────────────────────────────────────

export type FeedbackSummaryProps = {
  className?: string;
};

/**
 * Aggregate feedback summary widget — shows thumbs up/down ratio per agent.
 *
 * Reads directly from the localStorage annotation store (same source as
 * `useFeedback`). Auto-updates on cross-tab storage events.
 *
 * Hidden when there are no annotations (zero-state is invisible).
 *
 * Phase 2: wire to `annotations.list` RPC for server-side persistence.
 */
export const FeedbackSummary = memo(function FeedbackSummary({
  className,
}: FeedbackSummaryProps) {
  const { agentStats } = useAllAnnotations();
  const [collapsed, setCollapsed] = useState(false);

  // Don't render if there's nothing to show
  if (agentStats.length === 0) return null;

  const totalAnnotations = agentStats.reduce((s, a) => s + a.total, 0);

  return (
    <div
      className={cn(
        "mx-3 mb-2 rounded-lg border border-border/60 bg-card/50 py-1.5",
        className,
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between px-2 py-0.5 text-left transition-colors hover:bg-muted/40 rounded-md"
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand feedback summary" : "Collapse feedback summary"}
      >
        <div className="flex items-center gap-1.5">
          <ThumbsUp className="h-3 w-3 text-muted-foreground/70" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            Feedback
          </span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground/60 tabular-nums">
            {totalAnnotations}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground/50 transition-transform",
            collapsed && "-rotate-90",
          )}
        />
      </button>

      {/* Agent rows */}
      {!collapsed && (
        <div className="mt-1 space-y-0.5 px-1">
          {agentStats.map((stats) => (
            <AgentRow key={stats.agentId} stats={stats} />
          ))}
        </div>
      )}
    </div>
  );
});
