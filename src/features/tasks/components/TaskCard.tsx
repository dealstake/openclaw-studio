"use client";

import { memo, useCallback } from "react";
import { AlertTriangle, Clock, Play, CheckCircle2, XCircle, AlertCircle, Minus } from "lucide-react";
import type { StudioTask } from "@/features/tasks/types";
import { humanReadableSchedule } from "@/features/tasks/lib/schedule";
import { formatRelativeTime, formatDuration } from "@/lib/text/time";
import { STATUS_DOT_CLASS, getTaskStatusKey, STATUS_LABEL } from "@/features/tasks/lib/taskTypeConfig";
import { BaseCard, CardHeader } from "@/components/ui/BaseCard";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Abbreviate model name: "anthropic/claude-opus-4-6" → "opus" */
function abbreviateModel(model: string): string {
  if (!model || model === "default") return "default";
  const name = model.split("/").pop() ?? model;
  // Common abbreviations
  if (name.includes("opus")) return "opus";
  if (name.includes("sonnet")) return "sonnet";
  if (name.includes("haiku")) return "haiku";
  if (name.includes("gpt-4")) return "gpt-4";
  if (name.includes("gpt-3")) return "gpt-3.5";
  if (name.includes("gemini")) return "gemini";
  return name.length > 16 ? `${name.slice(0, 14)}…` : name;
}

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
  const isRunning = statusKey === "running";
  const hasErrors = (task.consecutiveErrors ?? 0) > 0;

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
      }${isOrphan ? " opacity-70" : ""}`}
      onClick={handleSelect}
      role="option"
      aria-selected={selected || focused}
      aria-label={`${task.name} — ${STATUS_LABEL[statusKey]}`}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSelect(); }}
      data-task-card
    >
      {/* Row 1: status dot + name + model badge */}
      <CardHeader>
        {isOrphan ? (
          <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
        ) : (
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground transition-colors duration-150 group-hover/card:text-primary" title={task.name}>
          {task.name}
          {isRunning && <span className="ml-1.5 text-xs font-normal text-purple-300">Running…</span>}
        </span>
        <span
          className="ml-2 shrink-0 rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          title={task.model}
        >
          {abbreviateModel(task.model)}
        </span>
      </CardHeader>

      {/* Row 2: description (one line, only if meaningful) */}
      {task.description && !task.description.startsWith("This task exists in the gateway") ? (
        <p className="mt-0.5 truncate text-xs leading-relaxed text-muted-foreground">
          {task.description}
        </p>
      ) : null}

      {/* Row 3: Metadata — frequency, next run, last run, errors */}
      {!isOrphan ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {/* Frequency */}
          <div className="flex items-center gap-1" title="Schedule frequency">
            <Clock className="h-3 w-3 shrink-0 opacity-60" />
            <span>{humanReadableSchedule(task.schedule, { compact: true })}</span>
          </div>

          {/* Next Run */}
          <div className="flex items-center gap-1" title={task.nextRunAtMs ? `Next run: ${new Date(task.nextRunAtMs).toLocaleString()}` : "No next run"}>
            <Play className="h-3 w-3 shrink-0 opacity-60" />
            <span>
              {statusKey === "paused"
                ? "Paused"
                : task.nextRunAtMs
                  ? formatRelativeTime(task.nextRunAtMs)
                  : "—"}
            </span>
          </div>

          {/* Last Run */}
          <div
            className="flex items-center gap-1"
            title={task.lastRunAt ? `Last run: ${new Date(task.lastRunAt).toLocaleString()}${task.lastDurationMs ? ` (${formatDuration(task.lastDurationMs)})` : ""}` : "Never run"}
          >
            {task.lastRunStatus === "success" && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />}
            {task.lastRunStatus === "error" && <XCircle className="h-3 w-3 shrink-0 text-destructive" />}
            {!task.lastRunStatus && <Minus className="h-3 w-3 shrink-0 opacity-40" />}
            <span>
              {task.lastRunAt
                ? `${formatRelativeTime(new Date(task.lastRunAt).getTime())}${task.lastDurationMs ? ` · ${formatDuration(task.lastDurationMs)}` : ""}`
                : "Never run"}
            </span>
          </div>

          {/* Consecutive Errors Badge */}
          {hasErrors && (
            <div className="ml-auto flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-destructive">
              <AlertCircle className="h-3 w-3" />
              {task.consecutiveErrors}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-destructive/80">Cron job missing — metadata only</p>
      )}
    </BaseCard>
  );
});
