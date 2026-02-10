"use client";

import { memo, useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Play, RefreshCw, Trash2 } from "lucide-react";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { formatCronPayload, formatCronSchedule, type CronJobSummary } from "@/lib/cron/types";

type CronRunEntry = {
  id: string;
  jobId: string;
  status: string;
  startedAtMs?: number;
  durationMs?: number;
  error?: string;
};

type CronRunsResult = {
  runs: CronRunEntry[];
};

type CronPanelProps = {
  client: GatewayClient;
  cronJobs: CronJobSummary[];
  loading: boolean;
  error: string | null;
  runBusyJobId: string | null;
  deleteBusyJobId: string | null;
  onRunJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onRefresh: () => void;
};

const formatRelativeTime = (timestamp: number | null | undefined): string => {
  if (!timestamp) return "—";
  const elapsed = Date.now() - timestamp;
  if (elapsed < 0) return "just now";
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const STATUS_PILL_CLASS: Record<string, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/15 text-emerald-600",
  error: "border-destructive/35 bg-destructive/12 text-destructive",
  skipped: "border-border/70 bg-muted text-muted-foreground",
};

export const CronPanel = memo(function CronPanel({
  client,
  cronJobs,
  loading,
  error,
  runBusyJobId,
  deleteBusyJobId,
  onRunJob,
  onDeleteJob,
  onRefresh,
}: CronPanelProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);

  const loadRuns = useCallback(
    async (jobId: string) => {
      setRunsLoading(true);
      setRunsError(null);
      try {
        const result = await client.call<CronRunsResult>("cron.runs", {
          jobId,
          limit: 10,
        });
        setRuns(Array.isArray(result.runs) ? result.runs : []);
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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Cron jobs
        </div>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          aria-label="Refresh cron jobs"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="mb-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </div>
        ) : null}

        {loading && cronJobs.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">Loading cron jobs…</div>
        ) : null}

        {!loading && !error && cronJobs.length === 0 ? (
          <EmptyStatePanel title="No cron jobs found." compact className="p-3 text-xs" />
        ) : null}

        {cronJobs.length > 0 ? (
          <div className="flex flex-col gap-2">
            {cronJobs.map((job) => {
              const runBusy = runBusyJobId === job.id;
              const deleteBusy = deleteBusyJobId === job.id;
              const busy = runBusy || deleteBusy;
              const isExpanded = expandedJobId === job.id;
              const lastStatusClass =
                STATUS_PILL_CLASS[job.state.lastStatus ?? ""] ??
                "border-border/70 bg-muted text-muted-foreground";

              return (
                <div
                  key={job.id}
                  className="rounded-md border border-border/80 bg-card/70"
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
                          <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                            {job.name}
                          </span>
                          {!job.enabled ? (
                            <span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] border border-border/70 bg-muted text-muted-foreground">
                              Disabled
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
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {formatCronPayload(job.payload)}
                        </div>
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
                              Last run: {formatRelativeTime(job.state.lastRunAtMs)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 transition group-focus-within/cron:opacity-100 group-hover/cron:opacity-100">
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        aria-label={`Run cron job ${job.name} now`}
                        onClick={() => onRunJob(job.id)}
                        disabled={busy}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-destructive/40 bg-transparent text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        aria-label={`Delete cron job ${job.name}`}
                        onClick={() => onDeleteJob(job.id)}
                        disabled={busy}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="border-t border-border/60 px-3 py-2">
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Run history
                      </div>
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
                                <span className="text-[10px] text-muted-foreground">
                                  {formatRelativeTime(run.startedAtMs)}
                                </span>
                                {run.durationMs !== undefined ? (
                                  <span className="text-[10px] text-muted-foreground">
                                    {run.durationMs}ms
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
    </div>
  );
});
