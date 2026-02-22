"use client";

import { memo } from "react";
import { Clock, Play, Trash2 } from "lucide-react";
import type { StudioTask, TaskSchedule } from "@/features/tasks/types";
import {
  PERIODIC_INTERVAL_OPTIONS,
  CONSTANT_INTERVAL_OPTIONS,
  STAGGER_OPTIONS,
} from "@/features/tasks/types";
import { humanReadableSchedule } from "@/features/tasks/lib/schedule";
import { formatRelativeTime } from "@/lib/text/time";
import { formatDurationCompact as formatDuration } from "@/lib/text/time";
import {
  TYPE_CONFIG,
  STATUS_DOT_CLASS,
  STATUS_LABEL,
  getTaskStatusKey,
} from "@/features/tasks/lib/taskTypeConfig";
import { sectionLabelClass } from "@/components/SectionLabel";
import { inputClass, textareaClass } from "@/features/tasks/lib/styles";

interface TaskMetadataSectionProps {
  task: StudioTask;
  editing: boolean;
  editDescription: string;
  editModel: string;
  busy: boolean;
  onFieldChange: (field: "name" | "description" | "model" | "prompt", value: string) => void;
  onUpdateSchedule: (taskId: string, schedule: TaskSchedule) => void;
  onToggle: (taskId: string, enabled: boolean) => void;
  onRun: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export const TaskMetadataSection = memo(function TaskMetadataSection({
  task,
  editing,
  editDescription,
  editModel,
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

        {/* Schedule */}
        {task.schedule.type === "periodic" ||
        task.schedule.type === "constant" ? (
          <div className="mt-2 flex items-center gap-2">
            <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
            <select
              aria-label="Task schedule interval"
              className="h-7 rounded-md border border-border/80 bg-card/70 px-2 font-mono text-[11px] text-foreground outline-none transition hover:border-border focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
              value={task.schedule.intervalMs}
              disabled={busy}
              onChange={(e) => {
                const ms = Number(e.target.value);
                const currentMs =
                  task.schedule.type === "constant" ||
                  task.schedule.type === "periodic"
                    ? task.schedule.intervalMs
                    : 0;
                if (!ms || ms === currentMs) return;
                const sched = task.schedule;
                const newSchedule: TaskSchedule =
                  sched.type === "constant"
                    ? {
                        type: "constant",
                        intervalMs: ms,
                        ...(sched.activeHours
                          ? { activeHours: sched.activeHours }
                          : {}),
                        ...(sched.staggerMs
                          ? { staggerMs: sched.staggerMs }
                          : {}),
                      }
                    : {
                        type: "periodic",
                        intervalMs: ms,
                        ...("staggerMs" in sched && sched.staggerMs
                          ? { staggerMs: sched.staggerMs }
                          : {}),
                      };
                onUpdateSchedule(task.id, newSchedule);
              }}
            >
              {(task.schedule.type === "constant"
                ? CONSTANT_INTERVAL_OPTIONS
                : PERIODIC_INTERVAL_OPTIONS
              ).map((opt) => (
                <option key={opt.ms} value={opt.ms}>
                  {opt.label}
                </option>
              ))}
            </select>
            {/* Stagger control */}
            <select
              aria-label="Task stagger window"
              className="h-7 rounded-md border border-border/80 bg-card/70 px-2 font-mono text-[11px] text-foreground outline-none transition hover:border-border focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
              value={task.schedule.staggerMs ?? 0}
              disabled={busy}
              onChange={(e) => {
                const staggerMs = Number(e.target.value);
                const current =
                  task.schedule.type === "constant" || task.schedule.type === "periodic"
                    ? (task.schedule.staggerMs ?? 0)
                    : 0;
                if (staggerMs === current) return;
                const newSchedule: TaskSchedule = {
                  ...task.schedule,
                  staggerMs: staggerMs || undefined,
                } as TaskSchedule;
                onUpdateSchedule(task.id, newSchedule);
              }}
            >
              {STAGGER_OPTIONS.map((opt) => (
                <option key={opt.ms} value={opt.ms}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-muted-foreground">
            {humanReadableSchedule(task.schedule)}
          </div>
        )}

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

        {/* Meta */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <span>Model:</span>
              <input
                className={`${inputClass} w-48`}
                value={editModel}
                onChange={(e) => onFieldChange("model", e.target.value)}
                placeholder="e.g. anthropic/claude-sonnet-4-6"
              />
            </div>
          ) : (
            <span>Model: {task.model.split("/").pop()}</span>
          )}
          <span>Agent: {task.agentId}</span>
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
          <span>Runs: {task.runCount}</span>
          {task.consecutiveErrors ? (
            <span className="font-semibold text-destructive">
              {task.consecutiveErrors} consecutive error
              {task.consecutiveErrors > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
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
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
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
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
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
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
            Delete
          </span>
        </button>
      </div>
    </>
  );
});
