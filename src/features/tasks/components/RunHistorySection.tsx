"use client";

import { memo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  SkipForward,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/text/time";
import { formatDurationCompact as formatDuration } from "@/lib/text/time";
import { Skeleton } from "@/components/Skeleton";
import { SectionLabel } from "@/components/SectionLabel";
import type { CronRunEntry } from "@/lib/cron/types";

// ─── Status config ───────────────────────────────────────────────────────────

const RUN_STATUS_ICON: Record<string, typeof CheckCircle2> = {
  ok: CheckCircle2,
  error: AlertCircle,
  skipped: SkipForward,
};

const RUN_STATUS_CLASS: Record<string, string> = {
  ok: "text-emerald-400",
  error: "text-destructive",
  skipped: "text-muted-foreground",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface RunHistorySectionProps {
  runs: CronRunEntry[];
  loading: boolean;
  error: string | null;
  /** When true, shows a "triggered, waiting for result…" banner */
  pendingTrigger?: boolean;
  onRetry: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const RunHistorySection = memo(function RunHistorySection({
  runs,
  loading,
  error,
  pendingTrigger,
  onRetry,
}: RunHistorySectionProps) {
  return (
    <div className="px-4 py-3">
      <SectionLabel>Run History</SectionLabel>

      {pendingTrigger ? (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary-text">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span>Triggered — waiting for result…</span>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-card/50 px-2 py-1.5"
            >
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-2.5 w-12" />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            className="shrink-0 rounded border border-destructive/40 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] transition hover:bg-destructive/20"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && runs.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-md border border-dashed border-border/50 py-6 text-center">
          <Clock className="h-5 w-5 text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground">
            No runs yet
          </p>
          <p className="max-w-[180px] text-xs text-muted-foreground">
            Run history will appear here after the task executes.
          </p>
        </div>
      ) : null}

      {!loading && runs.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1">
          {runs.map((run) => {
            const StatusIcon =
              RUN_STATUS_ICON[run.status] ?? SkipForward;
            const statusClass =
              RUN_STATUS_CLASS[run.status] ?? "text-muted-foreground";
            return (
              <div
                key={run.id}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-card/50 px-2 py-1.5"
              >
                <StatusIcon
                  className={`h-3 w-3 shrink-0 ${statusClass}`}
                />
                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
                  {run.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(run.startedAtMs)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDuration(run.durationMs)}
                </span>
                {run.error ? (
                  <span className="min-w-0 flex-1 truncate text-xs text-destructive">
                    {run.error}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
