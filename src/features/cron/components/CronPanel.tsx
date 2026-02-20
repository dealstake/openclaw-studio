"use client";

import { memo, useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Play, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import { Skeleton } from "@/components/Skeleton";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { formatCronPayload, formatCronSchedule, type CronJobSummary, type CronRunEntry, fetchCronRuns } from "@/lib/cron/types";
import { formatRelativeTime } from "@/lib/text/time";
import { PanelIconButton } from "@/components/PanelIconButton";
import { SectionLabel, sectionLabelClass } from "@/components/SectionLabel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type CronPanelProps = {
  client: GatewayClient;
  cronJobs: CronJobSummary[];
  loading: boolean;
  error: string | null;
  runBusyJobId: string | null;
  deleteBusyJobId: string | null;
  toggleBusyJobId?: string | null;
  onRunJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onToggleEnabled?: (jobId: string) => void;
  onRefresh: () => void;
};

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

export const CronPanel = memo(function CronPanel({
  client,
  cronJobs,
  loading,
  error,
  runBusyJobId,
  deleteBusyJobId,
  toggleBusyJobId,
  onRunJob,
  onDeleteJob,
  onToggleEnabled,
  onRefresh,
}: CronPanelProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [deleteConfirmJob, setDeleteConfirmJob] = useState<CronJobSummary | null>(null);

  const loadRuns = useCallback(
    async (jobId: string) => {
      setRunsLoading(true);
      setRunsError(null);
      try {
        const entries = await fetchCronRuns(client, jobId, 10);
        setRuns(entries);
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          const message = err instanceof Error ? err.message : "Failed to load run history.";
          setRunsError(message);
        }
        setRuns([]);
      } finally {
        setRunsLoading(false);
      }
    },
    [client]
  );

  const toggleExpanded = useCallback(
    (jobId: string) => {
      if (expandedJobId === jobId) {
        setExpandedJobId(null);
        setRuns([]);
        setRunsError(null);
      } else {
        setExpandedJobId(jobId);
        void loadRuns(jobId);
      }
    },
    [expandedJobId, loadRuns]
  );

  const enabledCount = cronJobs.filter((j) => j.enabled).length;
  const errorCount = cronJobs.filter((j) => j.state.lastStatus === "error").length;

  return (
    <TooltipProvider>
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <SectionLabel>
            Cron jobs
          </SectionLabel>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <PanelIconButton
                    aria-label="New cron job (use CLI)"
                    disabled
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </PanelIconButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Create jobs via CLI</p>
              </TooltipContent>
            </Tooltip>
            <PanelIconButton
              aria-label="Refresh cron jobs"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </PanelIconButton>
          </div>
        </div>

        {/* Summary bar */}
        {cronJobs.length > 0 ? (
          <div className="flex items-center gap-3 border-b border-border/30 px-4 py-1.5 text-[10px] text-muted-foreground">
            <span>{cronJobs.length} job{cronJobs.length !== 1 ? "s" : ""}</span>
            <span className="text-border">·</span>
            <span>{enabledCount} enabled</span>
            {errorCount > 0 ? (
              <>
                <span className="text-border">·</span>
                <span className="text-destructive">{errorCount} errored</span>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="mb-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
              {error}
            </div>
          ) : null}

          {loading && cronJobs.length === 0 ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-md border border-border/80 bg-card/70 p-3 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-48" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && !error && cronJobs.length === 0 ? (
            <EmptyStatePanel title="No cron jobs found." compact className="w-full p-4 text-center text-xs" />
          ) : null}

          {cronJobs.length > 0 ? (
            <div className="flex flex-col gap-2">
              {cronJobs.map((job) => {
                const runBusy = runBusyJobId === job.id;
                const deleteBusy = deleteBusyJobId === job.id;
                const toggleBusy = toggleBusyJobId === job.id;
                const busy = runBusy || deleteBusy || toggleBusy;
                const isExpanded = expandedJobId === job.id;
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
                    key={job.id}
                    className={`rounded-md border bg-card/70 ${
                      !job.enabled
                        ? "border-border/40 opacity-60"
                        : isRunning
                          ? "border-primary/40"
                          : "border-border/80"
                    }`}
                  >
                    <div className="group/cron flex items-start justify-between gap-2 px-3 py-2">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        onClick={() => toggleExpanded(job.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {/* Status dot */}
                            <span
                              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                                isRunning ? "bg-primary animate-pulse" : statusDotClass
                              }`}
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`truncate ${sectionLabelClass} text-foreground`}>
                                  {job.name}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">{job.name}</p>
                              </TooltipContent>
                            </Tooltip>
                            {!job.enabled ? (
                              <span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] border border-border/70 bg-muted text-muted-foreground">
                                Disabled
                              </span>
                            ) : null}
                            {isRunning ? (
                              <span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] border border-primary/30 bg-primary/15 text-primary animate-pulse">
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
                                className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] border ${lastStatusClass}`}
                              >
                                {job.state.lastStatus}
                              </span>
                            ) : null}
                            {job.state.lastRunAtMs ? (
                              <span className="text-[10px] text-muted-foreground">
                                Last: {formatRelativeTime(job.state.lastRunAtMs)}
                              </span>
                            ) : null}
                            {nextRun ? (
                              <span className="text-[10px] text-muted-foreground/70">
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
                                aria-label={job.enabled ? `Disable ${job.name}` : `Enable ${job.name}`}
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
                          onClick={() => onRunJob(job.id)}
                          disabled={busy}
                        >
                          <Play className="h-3.5 w-3.5" />
                        </PanelIconButton>
                        <PanelIconButton
                          variant="destructive"
                          aria-label={`Delete cron job ${job.name}`}
                          onClick={() => setDeleteConfirmJob(job)}
                          disabled={busy}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </PanelIconButton>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="border-t border-border/60 px-3 py-2">
                        {/* Expanded detail section */}
                        <div className="mb-2 space-y-1">
                          {job.payload.kind === "agentTurn" && job.payload.model ? (
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground/70">Model:</span> {job.payload.model}
                            </div>
                          ) : null}
                          {job.delivery ? (
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground/70">Delivery:</span> {job.delivery.mode}
                              {job.delivery.channel ? ` → ${job.delivery.channel}` : ""}
                            </div>
                          ) : null}
                          {job.state.runCount != null ? (
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground/70">Total runs:</span> {job.state.runCount}
                            </div>
                          ) : null}
                          {job.state.lastDurationMs != null ? (
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground/70">Last duration:</span>{" "}
                              {job.state.lastDurationMs < 1000
                                ? `${job.state.lastDurationMs}ms`
                                : `${(job.state.lastDurationMs / 1000).toFixed(1)}s`}
                            </div>
                          ) : null}
                          {job.state.lastError ? (
                            <div className="text-[11px] text-destructive">
                              <span className="font-medium">Last error:</span> {job.state.lastError}
                            </div>
                          ) : null}
                          {/* Full prompt text */}
                          <div className="mt-1.5">
                            <div className="text-[10px] font-medium text-foreground/70 mb-0.5">Prompt:</div>
                            <div className="max-h-24 overflow-y-auto rounded border border-border/40 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground whitespace-pre-wrap">
                              {payloadText}
                            </div>
                          </div>
                        </div>

                        <SectionLabel>
                          Run history
                        </SectionLabel>
                        {runsLoading ? (
                          <div className="mt-2 text-[11px] text-muted-foreground">
                            Loading runs…
                          </div>
                        ) : null}
                        {runsError ? (
                          <div className="mt-2 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
                            {runsError}
                          </div>
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
                                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] border ${runStatusClass}`}
                                  >
                                    {run.status}
                                  </span>
                                  {run.startedAtMs ? (
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatRelativeTime(run.startedAtMs)}
                                    </span>
                                  ) : null}
                                  {run.durationMs !== undefined ? (
                                    <span className="text-[10px] text-muted-foreground">
                                      {run.durationMs < 1000 ? `${run.durationMs}ms` : `${(run.durationMs / 1000).toFixed(1)}s`}
                                    </span>
                                  ) : null}
                                  {run.error ? (
                                    <span className="truncate text-[10px] text-destructive">
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
              })}
            </div>
          ) : null}
        </div>

        {/* Delete confirmation dialog */}
        <ConfirmDialog
          open={!!deleteConfirmJob}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmJob(null);
          }}
          title="Delete cron job"
          description={
            deleteConfirmJob
              ? `Are you sure you want to delete "${deleteConfirmJob.name}"? This action cannot be undone.`
              : ""
          }
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            if (deleteConfirmJob) {
              onDeleteJob(deleteConfirmJob.id);
              setDeleteConfirmJob(null);
            }
          }}
        />
      </div>
    </TooltipProvider>
  );
});
