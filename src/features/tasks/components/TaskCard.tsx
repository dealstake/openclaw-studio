"use client";

import { memo, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import type { StudioTask } from "@/features/tasks/types";
import { humanReadableSchedule } from "@/features/tasks/lib/schedule";
import { formatRelativeTime } from "@/lib/text/time";
import { STATUS_DOT_CLASS, getTaskStatusKey, STATUS_LABEL } from "@/features/tasks/lib/taskTypeConfig";
import { BaseCard, CardHeader } from "@/components/ui/BaseCard";

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
  selected,
  focused,
  onSelect,
}: TaskCardProps) {
  const isOrphan = task.managementStatus === "orphan";
  const statusKey = getTaskStatusKey(task);
  const dotClass = STATUS_DOT_CLASS[statusKey];

  const handleSelect = useCallback(() => {
    onSelect(task.id);
  }, [onSelect, task.id]);

  // Build the tertiary line: "Next run in Xm" or "Paused" or "Running…"
  const statusText = (() => {
    if (statusKey === "running") return "Running…";
    if (statusKey === "paused") return "Paused";
    if (statusKey === "error") return "Last run failed";
    if (task.nextRunAtMs) return `Next: ${formatRelativeTime(task.nextRunAtMs)}`;
    return humanReadableSchedule(task.schedule);
  })();

  return (
    <BaseCard
      variant="flush"
      isSelected={selected}
      isHoverable={!selected && !focused}
      className={`cursor-pointer ${
        focused && !selected
          ? "border-primary/30 bg-card/90 ring-1 ring-primary/10"
          : ""
      }${isOrphan ? " opacity-70" : ""}`}
      onClick={handleSelect}
      role="option"
      aria-selected={selected || focused}
      aria-label={`${task.name} — ${STATUS_LABEL[statusKey]}`}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSelect(); }}
      data-task-card
    >
      {/* Row 1: status dot + name */}
      <CardHeader>
        {isOrphan ? (
          <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
        ) : (
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={task.name}>
          {task.name}
        </span>
      </CardHeader>

      {/* Row 2: description (one line) */}
      {task.description ? (
        <p className="mt-0.5 truncate text-xs leading-relaxed text-muted-foreground">
          {task.description}
        </p>
      ) : null}

      {/* Row 3: status / next run */}
      <p className={`mt-1 text-xs ${
        statusKey === "running" ? "font-semibold text-purple-300" :
        statusKey === "error" ? "font-semibold text-destructive" :
        statusKey === "paused" ? "text-muted-foreground/70" :
        "text-muted-foreground"
      }`}>
        {isOrphan ? "Cron job missing — metadata only" : statusText}
      </p>
    </BaseCard>
  );
});
