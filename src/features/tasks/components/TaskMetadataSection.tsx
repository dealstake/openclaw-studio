"use client";

import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import type { StudioTask } from "@/features/tasks/types";
import { TaskScheduleEditor } from "./TaskScheduleEditor";
import { TaskActions } from "./TaskActions";
import { useTaskActions } from "@/features/tasks/context/TaskActionsContext";
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
}

export const TaskMetadataSection = memo(function TaskMetadataSection({
  task,
  editing,
  editDescription,
  busy,
  onFieldChange,
}: TaskMetadataSectionProps) {
  const { onUpdateSchedule } = useTaskActions();
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
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] ${typeConfig.className}`}
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
      <TaskActions
        taskId={task.id}
        enabled={task.enabled}
        managementStatus={task.managementStatus}
        busy={busy}
      />
    </>
  );
});
