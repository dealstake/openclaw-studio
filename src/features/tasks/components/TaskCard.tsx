"use client";

import { memo, useCallback } from "react";
import { Loader2, Play, Trash2 } from "lucide-react";
import type { StudioTask } from "@/features/tasks/types";
import { humanReadableSchedule } from "@/features/tasks/lib/schedule";
import { formatRelativeTime } from "@/lib/text/time";
import { TYPE_CONFIG, STATUS_DOT_CLASS, getTaskStatusKey } from "@/features/tasks/lib/taskTypeConfig";

// ─── Component ───────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: StudioTask;
  busy: boolean;
  selected: boolean;
  onSelect: (taskId: string) => void;
  onToggle: (taskId: string, enabled: boolean) => void;
  onRun: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  /** Which action is currently in progress for this task */
  busyAction?: "toggle" | "run" | "delete" | "update" | null;
}

export const TaskCard = memo(function TaskCard({
  task,
  busy,
  selected,
  onSelect,
  onToggle,
  onRun,
  onDelete,
  busyAction,
}: TaskCardProps) {
  const typeConfig = TYPE_CONFIG[task.type];
  const TypeIcon = typeConfig.icon;

  const statusKey = getTaskStatusKey(task);
  const dotClass = STATUS_DOT_CLASS[statusKey];

  const handleToggle = useCallback(() => {
    onToggle(task.id, !task.enabled);
  }, [onToggle, task.id, task.enabled]);

  const handleRun = useCallback(() => {
    onRun(task.id);
  }, [onRun, task.id]);

  const handleSelect = useCallback(() => {
    onSelect(task.id);
  }, [onSelect, task.id]);

  const handleDelete = useCallback(() => {
    onDelete(task.id);
  }, [onDelete, task.id]);

  return (
    <div
      className={`group/task rounded-md border bg-card/70 px-3 py-2.5 cursor-pointer transition ${
        selected
          ? "border-primary/50 bg-primary/5"
          : "border-border/80 hover:border-border"
      }`}
      onClick={handleSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSelect(); }}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Left: status dot + info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
            <span className="truncate font-mono text-[11px] font-semibold tracking-wide text-foreground">
              {task.name}
            </span>
          </div>

          {/* Type badge + schedule */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${typeConfig.className}`}
            >
              <TypeIcon className="h-2.5 w-2.5" />
              {typeConfig.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {humanReadableSchedule(task.schedule)}
            </span>
          </div>

          {/* Description */}
          {task.description ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
              {task.description}
            </p>
          ) : null}

          {/* Last run */}
          {task.lastRunAt ? (
            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Last run: {formatRelativeTime(new Date(task.lastRunAt).getTime())}</span>
              {task.lastRunStatus === "error" ? (
                <span className="font-semibold text-destructive">Failed</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Right: actions */}
        {/* Always visible on touch devices, hover-reveal on desktop */}
        <div className="flex items-center gap-1 transition md:opacity-0 md:group-focus-within/task:opacity-100 md:group-hover/task:opacity-100">
          {/* Toggle */}
          <button
            type="button"
            aria-label={task.enabled ? "Pause task" : "Resume task"}
            className={`relative h-5 w-9 rounded-full border transition ${
              task.enabled
                ? "border-emerald-500/40 bg-emerald-500/20"
                : "border-border/80 bg-muted/40"
            }`}
            onClick={handleToggle}
            disabled={busy}
          >
            <span
              className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
                task.enabled
                  ? "left-[18px] bg-emerald-400"
                  : "left-0.5 bg-muted-foreground"
              }`}
            />
          </button>

          {/* Run now */}
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            aria-label={`Run task ${task.name} now`}
            onClick={handleRun}
            disabled={busy}
          >
            {busyAction === "run" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Delete */}
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md border border-destructive/40 bg-transparent text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            aria-label={`Delete task ${task.name}`}
            onClick={handleDelete}
            disabled={busy}
          >
            {busyAction === "delete" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
