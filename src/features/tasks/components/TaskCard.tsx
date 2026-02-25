"use client";

import { memo, useCallback } from "react";
import type { StudioTask } from "@/features/tasks/types";
import { humanReadableSchedule } from "@/features/tasks/lib/schedule";
import { formatRelativeTime } from "@/lib/text/time";
import { formatDurationCompact as formatDuration } from "@/lib/text/time";
import { TYPE_CONFIG, STATUS_DOT_CLASS, getTaskStatusKey } from "@/features/tasks/lib/taskTypeConfig";
import { BaseCard, CardHeader, CardBadge, CardMeta } from "@/components/ui/BaseCard";

// ─── Component ───────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: StudioTask;
  busy: boolean;
  selected: boolean;
  /** Whether this card has keyboard focus via arrow keys */
  focused?: boolean;
  onSelect: (taskId: string) => void;
  onToggle: (taskId: string, enabled: boolean) => void;
  /** Which action is currently in progress for this task */
  busyAction?: "toggle" | "run" | "delete" | "update" | null;
}

export const TaskCard = memo(function TaskCard({
  task,
  busy,
  selected,
  focused,
  onSelect,
  onToggle,
  busyAction,
}: TaskCardProps) {
  const typeConfig = TYPE_CONFIG[task.type];
  const TypeIcon = typeConfig.icon;

  const statusKey = getTaskStatusKey(task);
  const dotClass = STATUS_DOT_CLASS[statusKey];

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(task.id, !task.enabled);
  }, [onToggle, task.id, task.enabled]);

  const handleSelect = useCallback(() => {
    onSelect(task.id);
  }, [onSelect, task.id]);

  return (
    <BaseCard
      variant="flush"
      isSelected={selected}
      isHoverable={!selected && !focused}
      className={`cursor-pointer ${
        focused && !selected
          ? "border-primary/30 bg-card/90 ring-1 ring-primary/10"
          : ""
      }`}
      onClick={handleSelect}
      role="option"
      aria-selected={selected || focused}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSelect(); }}
      data-task-card
    >
      {/* Title row: status dot + name + toggle */}
      <CardHeader>
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={task.name}>
          {task.name}
        </span>
        {/* Persistent toggle — green when enabled, grey when disabled */}
        <button
          type="button"
          aria-label={task.enabled ? "Pause task" : "Resume task"}
          disabled={busy || busyAction === "toggle"}
          className={`relative h-5 w-9 shrink-0 rounded-full border transition disabled:opacity-50 disabled:cursor-not-allowed ${
            task.enabled
              ? "border-emerald-500/50 bg-emerald-500/30"
              : "border-border bg-muted/50"
          }`}
          onClick={handleToggle}
        >
          <span
            className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all shadow-sm ${
              task.enabled
                ? "left-[17px] bg-emerald-400"
                : "left-0.5 bg-muted-foreground/70"
            }`}
          />
        </button>
      </CardHeader>

      {/* Type badge + schedule */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <CardBadge className={typeConfig.className}>
          <TypeIcon className="h-2.5 w-2.5" />
          {typeConfig.label}
        </CardBadge>
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

      {/* Runtime info */}
      <CardMeta className="mt-1 flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
        {task.runningAtMs ? (
          <span className="font-semibold text-purple-400">Running…</span>
        ) : task.nextRunAtMs ? (
          <span>
            Next: {formatRelativeTime(task.nextRunAtMs)}
          </span>
        ) : null}
        {task.lastRunAt ? (
          <span>
            Last: {formatRelativeTime(new Date(task.lastRunAt).getTime())}
            {task.lastDurationMs ? ` · ${formatDuration(task.lastDurationMs)}` : ""}
          </span>
        ) : null}
        {task.lastRunStatus === "error" ? (
          <span className="font-semibold text-destructive">Failed</span>
        ) : task.lastRunStatus === "success" ? (
          <span className="font-semibold text-emerald-400">OK</span>
        ) : null}
        {task.runCount > 0 ? (
          <span>Runs: {task.runCount}</span>
        ) : null}
      </CardMeta>
    </BaseCard>
  );
});
