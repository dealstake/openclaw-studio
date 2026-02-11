"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Play,
  Trash2,
  Zap,
  Clock,
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  SkipForward,
} from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { StudioTask, TaskType } from "@/features/tasks/types";
import { humanReadableSchedule } from "@/features/tasks/lib/schedule";
import { formatRelativeTime } from "@/lib/text/time";
import { Skeleton } from "@/components/Skeleton";

// ─── Run history types ───────────────────────────────────────────────────────

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

// ─── Type badge config (shared with TaskCard) ────────────────────────────────

const TYPE_CONFIG: Record<
  TaskType,
  { label: string; icon: typeof Zap; className: string }
> = {
  constant: {
    label: "Constant",
    icon: Zap,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  periodic: {
    label: "Periodic",
    icon: Clock,
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  },
  scheduled: {
    label: "Scheduled",
    icon: Calendar,
    className: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  },
};

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

interface TaskDetailDrawerProps {
  task: StudioTask | null;
  client: GatewayClient;
  busy: boolean;
  onClose: () => void;
  onToggle: (taskId: string, enabled: boolean) => void;
  onRun: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskDetailDrawer = memo(function TaskDetailDrawer({
  task,
  client,
  busy,
  onClose,
  onToggle,
  onRun,
  onDelete,
}: TaskDetailDrawerProps) {
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const loadingRef = useRef(false);

  const loadRuns = useCallback(
    async (cronJobId: string) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setRunsLoading(true);
      setRunsError(null);
      try {
        const result = await client.call<CronRunsResult>("cron.runs", {
          jobId: cronJobId,
          limit: 20,
        });
        setRuns(Array.isArray(result.runs) ? result.runs : []);
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          const message =
            err instanceof Error ? err.message : "Failed to load run history.";
          setRunsError(message);
        }
        setRuns([]);
      } finally {
        loadingRef.current = false;
        setRunsLoading(false);
      }
    },
    [client]
  );

  // Load runs when task changes
  useEffect(() => {
    if (!task) {
      setRuns([]);
      setRunsError(null);
      setPromptExpanded(false);
      return;
    }
    void loadRuns(task.cronJobId);
  }, [task, loadRuns]);

  if (!task) return null;

  const typeConfig = TYPE_CONFIG[task.type];
  const TypeIcon = typeConfig.icon;

  const statusKey =
    task.lastRunStatus === "error"
      ? "error"
      : task.enabled
        ? "active"
        : "paused";

  const statusLabel =
    statusKey === "error"
      ? "Error"
      : statusKey === "active"
        ? "Active"
        : "Paused";

  const statusDotClass =
    statusKey === "error"
      ? "bg-destructive"
      : statusKey === "active"
        ? "bg-emerald-400"
        : "bg-muted-foreground";

  const formatDuration = (ms: number | undefined) => {
    if (ms === undefined) return "—";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60_000).toFixed(1)}m`;
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Task Detail
          </div>
          <div className="mt-0.5 truncate font-mono text-sm font-semibold text-foreground">
            {task.name}
          </div>
        </div>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65"
          type="button"
          aria-label="Close task detail"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Status + type */}
        <div className="border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                {statusLabel}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${typeConfig.className}`}
            >
              <TypeIcon className="h-2.5 w-2.5" />
              {typeConfig.label}
            </span>
          </div>

          {/* Schedule */}
          <div className="mt-2 text-[11px] text-muted-foreground">
            {humanReadableSchedule(task.schedule)}
          </div>

          {/* Description */}
          {task.description ? (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {task.description}
            </p>
          ) : null}

          {/* Meta */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            <span>Model: {task.model.split("/").pop()}</span>
            <span>Agent: {task.agentId}</span>
            {task.lastRunAt ? (
              <span>
                Last run: {formatRelativeTime(new Date(task.lastRunAt).getTime())}
              </span>
            ) : null}
            <span>Runs: {task.runCount}</span>
          </div>
        </div>

        {/* Prompt preview */}
        <div className="border-b border-border/40 px-4 py-3">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 text-left"
            onClick={() => setPromptExpanded((p) => !p)}
          >
            {promptExpanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Prompt
            </span>
          </button>
          {promptExpanded ? (
            <pre className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border/60 bg-card/50 p-2 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
              {task.prompt}
            </pre>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
          <button
            type="button"
            className={`flex h-7 items-center gap-1.5 rounded-md border px-2.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
              task.enabled
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            }`}
            onClick={() => onToggle(task.id, !task.enabled)}
            disabled={busy}
          >
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]">
              {task.enabled ? "Pause" : "Resume"}
            </span>
          </button>
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-md border border-border/80 bg-card/70 px-2.5 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onRun(task.id)}
            disabled={busy}
          >
            <Play className="h-3 w-3" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]">
              Run Now
            </span>
          </button>
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-md border border-destructive/40 bg-transparent px-2.5 text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onDelete(task.id)}
            disabled={busy}
          >
            <Trash2 className="h-3 w-3" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]">
              Delete
            </span>
          </button>
        </div>

        {/* Run history */}
        <div className="px-4 py-3">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Run History
          </div>

          {runsLoading ? (
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

          {runsError ? (
            <div className="mt-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-[10px] text-destructive">
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
                const StatusIcon =
                  RUN_STATUS_ICON[run.status] ?? SkipForward;
                const statusClass =
                  RUN_STATUS_CLASS[run.status] ?? "text-muted-foreground";
                return (
                  <div
                    key={run.id}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-card/50 px-2 py-1.5"
                  >
                    <StatusIcon className={`h-3 w-3 shrink-0 ${statusClass}`} />
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground">
                      {run.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(run.startedAtMs)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDuration(run.durationMs)}
                    </span>
                    {run.error ? (
                      <span className="min-w-0 flex-1 truncate text-[10px] text-destructive">
                        {run.error}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
