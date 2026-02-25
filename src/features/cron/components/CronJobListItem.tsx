"use client";

import { memo, useCallback, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Play,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  formatCronPayload,
  formatCronSchedule,
  type CronJobSummary,
} from "@/lib/cron/types";
import { formatRelativeTime, formatDurationCompact } from "@/lib/text/time";
import { PanelIconButton } from "@/components/PanelIconButton";
import { SectionLabel, sectionLabelClass } from "@/components/SectionLabel";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCronRuns } from "@/features/cron/hooks/useCronRuns";

const STATUS_PILL_CLASS: Record<string, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  error: "border-destructive/35 bg-destructive/12 text-destructive",
  skipped: "border-border/70 bg-muted text-muted-foreground",
};

const STATUS_DOT_CLASS: Record<string, string> = {
  ok: "bg-emerald-400",
  error: "bg-destructive",
  skipped: "bg-muted-foreground",
};

function formatNextRun(state: CronJobSummary["state"]): string | null {
  if (!state.nextRunAtMs) return null;
  const now = Date.now();
  const diff = state.nextRunAtMs - now;
  if (diff <= 0) return "due now";
  if (diff < 60_000) return `in ${Math.ceil(diff / 1000)}s`;
  if (diff < 3_600_000) return `in ${Math.ceil(diff / 60_000)}m`;
  return `in ${Math.round(diff / 3_600_000)}h`;
}

// Removed local formatDurationMs — using shared formatDurationCompact from @/lib/text/time

export type CronJobListItemProps = {
  job: CronJobSummary;
  client: GatewayClient;
  runBusy: boolean;
  deleteBusy: boolean;
  toggleBusy: boolean;
  onRunJob: (jobId: string) => void;
  onDeleteConfirm: (job: CronJobSummary) => void;
  onToggleEnabled?: (jobId: string) => void;
  animationDelay: number;
};

export const CronJobListItem = memo(function CronJobListItem({
  job,
  client,
  runBusy,
  deleteBusy,
  toggleBusy,
  onRunJob,
  onDeleteConfirm,
  onToggleEnabled,
  animationDelay,
}: CronJobListItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { runs, loading: runsLoading, error: runsError, load: loadRuns, reset: resetRuns } = useCronRuns(client, job.id);

  const toggleExpanded = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      resetRuns();
    } else {
      setExpanded(true);
      void loadRuns();
    }
  }, [expanded, loadRuns, resetRuns]);

  const busy = runBusy || deleteBusy || toggleBusy;
  const lastStatusClass =
    STATUS_PILL_CLASS[job.state.lastStatus ?? ""] ??
    "border-border/70 bg-muted text-muted-foreground";
  const statusDotClass =
    STATUS_DOT_CLASS[job.state.lastStatus ?? ""] ?? "bg-muted-foreground";
  const isRunning = !!job.state.runningAtMs;
  const nextRun = formatNextRun(job.state);
  const payloadText = formatCronPayload(job.payload);

  return (
    <div
      style={{ animationDelay: `${animationDelay}ms` }}
      className={`animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-both rounded-md border bg-card/70 transition-all ${
        !job.enabled
          ? "border-border/40 opacity-60"
          : isRunning
            ? "border-primary/40"
            : "border-border/80 hover:border-border hover:shadow-sm"
      }`}
    >
      <div className="group/cron flex items-start justify-between gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls={`cron-detail-${job.id}`}
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  isRunning ? "bg-primary animate-pulse" : statusDotClass
                }`}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={`truncate ${sectionLabelClass} text-foreground`}
                  >
                    {job.name}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{job.name}</p>
                </TooltipContent>
              </Tooltip>
              {!job.enabled ? (
                <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] border border-border/70 bg-muted text-muted-foreground">
                  Disabled
                </span>
              ) : null}
              {isRunning ? (
                <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] border border-primary/30 bg-primary/15 text-primary animate-pulse">
                  Running
                </span>
              ) : null}
            </div>
            {job.agentId ? (
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Agent: {job.agentId}
              </div>
            ) : null}
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {formatCronSchedule(job.schedule)}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {payloadText}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm">
                <p className="whitespace-pre-wrap text-xs">{payloadText}</p>
              </TooltipContent>
            </Tooltip>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {job.state.lastStatus ? (
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] border ${lastStatusClass}`}
                >
                  {job.state.lastStatus}
                </span>
              ) : null}
              {job.state.lastRunAtMs ? (
                <span className="text-xs text-muted-foreground">
                  Last: {formatRelativeTime(job.state.lastRunAtMs)}
                </span>
              ) : null}
              {nextRun ? (
                <span className="text-xs text-muted-foreground/70">
                  Next: {nextRun}
                </span>
              ) : null}
            </div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {onToggleEnabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <PanelIconButton
                  aria-label={
                    job.enabled
                      ? `Disable ${job.name}`
                      : `Enable ${job.name}`
                  }
                  onClick={() => onToggleEnabled(job.id)}
                  disabled={busy}
                >
                  {job.enabled ? (
                    <ToggleRight className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ToggleLeft className="h-3.5 w-3.5" />
                  )}
                </PanelIconButton>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{job.enabled ? "Disable" : "Enable"}</p>
              </TooltipContent>
            </Tooltip>
          ) : null}
          <PanelIconButton
            aria-label={`Run cron job ${job.name} now`}
            data-testid={`cron-run-${job.id}`}
            onClick={() => onRunJob(job.id)}
            disabled={busy}
          >
            <Play className="h-3.5 w-3.5" />
          </PanelIconButton>
          <PanelIconButton
            variant="destructive"
            aria-label={`Delete cron job ${job.name}`}
            data-testid={`cron-delete-${job.id}`}
            onClick={() => onDeleteConfirm(job)}
            disabled={busy}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </PanelIconButton>
        </div>
      </div>

      {expanded ? (
        <div
          id={`cron-detail-${job.id}`}
          className="border-t border-border/60 px-3 py-2"
        >
          <div className="mb-2 space-y-1">
            {job.payload.kind === "agentTurn" && job.payload.model ? (
              <div className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/70">Model:</span>{" "}
                {job.payload.model}
              </div>
            ) : null}
            {job.delivery ? (
              <div className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/70">
                  Delivery:
                </span>{" "}
                {job.delivery.mode}
                {job.delivery.channel ? ` → ${job.delivery.channel}` : ""}
              </div>
            ) : null}
            {job.state.runCount != null ? (
              <div className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/70">
                  Total runs:
                </span>{" "}
                {job.state.runCount}
              </div>
            ) : null}
            {job.state.lastDurationMs != null ? (
              <div className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/70">
                  Last duration:
                </span>{" "}
                {formatDurationCompact(job.state.lastDurationMs)}
              </div>
            ) : null}
            {job.state.lastError ? (
              <div className="text-[11px] text-destructive">
                <span className="font-medium">Last error:</span>{" "}
                {job.state.lastError}
              </div>
            ) : null}
            <div className="mt-1.5">
              <div className="mb-0.5 text-xs font-medium text-foreground/70">
                Prompt:
              </div>
              <div className="max-h-24 overflow-y-auto rounded border border-border/40 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground whitespace-pre-wrap">
                {payloadText}
              </div>
            </div>
          </div>

          <SectionLabel>Run history</SectionLabel>
          {runsLoading ? (
            <div className="mt-2 text-[11px] text-muted-foreground">
              Loading runs…
            </div>
          ) : null}
          {runsError ? (
            <ErrorBanner
              className="mt-2"
              message={runsError}
              onRetry={() => void loadRuns()}
            />
          ) : null}
          {!runsLoading && !runsError && runs.length === 0 ? (
            <div className="mt-2 text-[11px] text-muted-foreground">
              No run history available.
            </div>
          ) : null}
          {!runsLoading && runs.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1">
              {runs.map((run) => {
                const runStatusClass =
                  STATUS_PILL_CLASS[run.status] ??
                  "border-border/70 bg-muted text-muted-foreground";
                return (
                  <div
                    key={run.id}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-card/50 px-2 py-1"
                  >
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] border ${runStatusClass}`}
                    >
                      {run.status}
                    </span>
                    {run.startedAtMs ? (
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(run.startedAtMs)}
                      </span>
                    ) : null}
                    {run.durationMs !== undefined ? (
                      <span className="text-xs text-muted-foreground">
                        {formatDurationCompact(run.durationMs)}
                      </span>
                    ) : null}
                    {run.error ? (
                      <span className="truncate text-xs text-destructive">
                        {run.error}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
