"use client";

import { memo } from "react";
import { AlertTriangle, Play, Trash2 } from "lucide-react";
import type { StudioTask, TaskSchedule } from "@/features/tasks/types";
import { TaskScheduleEditor } from "./TaskScheduleEditor";
import { formatRelativeTime } from "@/lib/text/time";
import { formatDurationCompact as formatDuration } from "@/lib/text/time";
import {
  TYPE_CONFIG,
  STATUS_DOT_CLASS,
  STATUS_LABEL,
  getTaskStatusKey,
} from "@/features/tasks/lib/taskTypeConfig";
import { sectionLabelClass } from "@/components/SectionLabel";
import { textareaClass } from "@/features/tasks/lib/styles";

interface TaskMetadataSectionProps {
  task: StudioTask;
  editing: boolean;
  editDescription: string;
  busy: boolean;
  onFieldChange: (field: "description", value: string) => void;
  onUpdateSchedule: (taskId: string, schedule: TaskSchedule) => void;
  onToggle: (taskId: string, enabled: boolean) => void;
  onRun: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export const TaskMetadataSection = memo(function TaskMetadataSection({
  task,
  editing,
  editDescription,
  busy,
  onFieldChange,
  onUpdateSchedule,
  onToggle,
  onRun,
  onDelete,
}: TaskMetadataSectionProps) {
  const typeConfig = TYPE_CONFIG[task.type];
  const TypeIcon = typeConfig.icon;
  const statusKey = getTaskStatusKey(task);
  const statusLabel = STATUS_LABEL[statusKey];
  const statusDotClass = STATUS_DOT_CLASS[statusKey];

  return (
    <>
      {/* Status + type + schedule + description + meta */}
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
            <span className={`${sectionLabelClass} text-foreground`}>
              {statusLabel}
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${typeConfig.className}`}
          >
            <TypeIcon className="h-2.5 w-2.5" />
            {typeConfig.label}
          </span>
        </div>

        {/* Schedule — staged editing with Save/Cancel */}
        <TaskScheduleEditor
          schedule={task.schedule}
          busy={busy}
          onSave={(newSchedule) => onUpdateSchedule(task.id, newSchedule)}
        />

        {/* Description */}
        {editing ? (
          <textarea
            className={`${textareaClass} mt-2 min-h-[3rem]`}
            value={editDescription}
            onChange={(e) => onFieldChange("description", e.target.value)}
            placeholder="Task description (optional)"
            rows={2}
          />
        ) : task.description ? (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {task.description}
          </p>
        ) : null}

        {/* Essential meta — always visible */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {task.runningAtMs ? (
            <span className="font-semibold text-purple-400">● Running now</span>
          ) : task.nextRunAtMs ? (
            <span>Next run: {formatRelativeTime(task.nextRunAtMs)}</span>
          ) : null}
          {task.lastRunAt ? (
            <span>
              Last run: {formatRelativeTime(new Date(task.lastRunAt).getTime())}
              {task.lastDurationMs
                ? ` (${formatDuration(task.lastDurationMs)})`
                : ""}
            </span>
          ) : null}
        </div>
      </div>

      {/* Orphan warning banner */}
      {task.managementStatus === "orphan" ? (
        <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <div className="text-[11px] leading-relaxed text-destructive">
            <span className="font-semibold">Cron job missing.</span>{" "}
            Task metadata exists but no matching gateway cron job was found.
            You can delete the orphaned metadata or recreate the task.
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
        {task.managementStatus !== "orphan" ? (
          <>
            <button
              type="button"
              className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                task.enabled
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              }`}
              onClick={() => onToggle(task.id, !task.enabled)}
              disabled={busy}
            >
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                {task.enabled ? "Pause" : "Resume"}
              </span>
            </button>
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-card/70 px-2.5 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onRun(task.id)}
              disabled={busy}
            >
              <Play className="h-3 w-3" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                Trigger Run
              </span>
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-transparent px-2.5 text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onDelete(task.id)}
          disabled={busy}
        >
          <Trash2 className="h-3 w-3" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
            {task.managementStatus === "orphan" ? "Delete Metadata" : "Delete"}
          </span>
        </button>
      </div>
    </>
  );
});
