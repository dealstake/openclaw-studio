"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTaskEditForm } from "@/features/tasks/hooks/useTaskEditForm";
import {
  X,
  Play,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  SkipForward,
  Pencil,
  Save,
} from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { StudioTask, TaskSchedule, UpdateTaskPayload } from "@/features/tasks/types";
import {
  PERIODIC_INTERVAL_OPTIONS,
  CONSTANT_INTERVAL_OPTIONS,
} from "@/features/tasks/types";
import { humanReadableSchedule } from "@/features/tasks/lib/schedule";
import { formatRelativeTime } from "@/lib/text/time";
import { formatDuration } from "@/features/tasks/lib/format";
import { Skeleton } from "@/components/Skeleton";
import { TYPE_CONFIG, STATUS_DOT_CLASS, STATUS_LABEL, getTaskStatusKey } from "@/features/tasks/lib/taskTypeConfig";
import { PanelIconButton } from "@/components/PanelIconButton";
import { SectionLabel, sectionLabelClass} from "@/components/SectionLabel";

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
  onUpdateTask: (taskId: string, updates: UpdateTaskPayload) => void;
  onUpdateSchedule: (taskId: string, schedule: TaskSchedule) => void;
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
  onUpdateTask,
  onUpdateSchedule,
  onRun,
  onDelete,
}: TaskDetailDrawerProps) {
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const loadingRef = useRef(false);

  // ─── Edit mode state (consolidated via useReducer) ────────────────────────
  const {
    editing, editName, editDescription, editPrompt, editModel,
    startEditing: startEditingForm, cancelEditing, saveEdits, setField,
  } = useTaskEditForm({ task, onUpdateTask });

  const startEditing = useCallback(() => {
    startEditingForm();
    setPromptExpanded(true);
  }, [startEditingForm]);

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

  // Load runs when task changes; reset edit mode
  useEffect(() => {
    if (!task) {
      setRuns([]);
      setRunsError(null);
      setPromptExpanded(false);
      cancelEditing();
      return;
    }
    void loadRuns(task.cronJobId);
  }, [task, loadRuns, cancelEditing]);

  if (!task) return null;

  const typeConfig = TYPE_CONFIG[task.type];
  const TypeIcon = typeConfig.icon;

  const statusKey = getTaskStatusKey(task);
  const statusLabel = STATUS_LABEL[statusKey];
  const statusDotClass = STATUS_DOT_CLASS[statusKey];

  const inputClass =
    "h-7 w-full rounded-md border border-border/80 bg-card/70 px-2 font-mono text-[11px] text-foreground outline-none transition hover:border-border focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60";

  const textareaClass =
    "w-full rounded-md border border-border/80 bg-card/70 p-2 font-mono text-[10px] leading-relaxed text-foreground outline-none transition hover:border-border focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60 resize-y";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
        <div className="min-w-0 flex-1">
          <SectionLabel>
            Task Detail
          </SectionLabel>
          {editing ? (
            <input
              className={`${inputClass} mt-0.5 font-semibold`}
              value={editName}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Task name"
              autoFocus
            />
          ) : (
            <div className="mt-0.5 truncate font-mono text-sm font-semibold text-foreground">
              {task.name}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button
                className="flex h-7 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                aria-label="Save changes"
                onClick={saveEdits}
                disabled={busy || !editName.trim()}
              >
                <Save className="h-3 w-3" />
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]">Save</span>
              </button>
              <button
                className="flex h-7 items-center justify-center rounded-md border border-border/80 bg-card/70 px-2 text-muted-foreground transition hover:border-border hover:bg-muted/65"
                type="button"
                aria-label="Cancel editing"
                onClick={cancelEditing}
              >
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]">Cancel</span>
              </button>
            </>
          ) : (
            <>
              <PanelIconButton
                aria-label="Edit task"
                onClick={startEditing}
              >
                <Pencil className="h-3 w-3" />
              </PanelIconButton>
              <PanelIconButton
                aria-label="Close task detail"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
              </PanelIconButton>
            </>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Status + type */}
        <div className="border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
              <span className={`${sectionLabelClass} text-foreground`}>
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

          {/* Schedule — editable for periodic/constant, read-only for scheduled */}
          {(task.schedule.type === "periodic" || task.schedule.type === "constant") ? (
            <div className="mt-2 flex items-center gap-2">
              <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
              <select
                className="h-7 rounded-md border border-border/80 bg-card/70 px-2 font-mono text-[11px] text-foreground outline-none transition hover:border-border focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
                value={task.schedule.intervalMs}
                disabled={busy}
                onChange={(e) => {
                  const ms = Number(e.target.value);
                  const currentMs = task.schedule.type === "constant" || task.schedule.type === "periodic"
                    ? task.schedule.intervalMs : 0;
                  if (!ms || ms === currentMs) return;
                  const newSchedule: TaskSchedule =
                    task.schedule.type === "constant"
                      ? { type: "constant", intervalMs: ms, ...(task.schedule.activeHours ? { activeHours: task.schedule.activeHours } : {}) }
                      : { type: "periodic", intervalMs: ms };
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
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Task description (optional)"
              rows={2}
            />
          ) : task.description ? (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {task.description}
            </p>
          ) : null}

          {/* Meta */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            {editing ? (
              <div className="flex items-center gap-1.5">
                <span>Model:</span>
                <input
                  className={`${inputClass} w-48`}
                  value={editModel}
                  onChange={(e) => setField("model", e.target.value)}
                  placeholder="e.g. anthropic/claude-sonnet-4-6"
                />
              </div>
            ) : (
              <span>Model: {task.model.split("/").pop()}</span>
            )}
            <span>Agent: {task.agentId}</span>
            {task.lastRunAt ? (
              <span>
                Last run: {formatRelativeTime(new Date(task.lastRunAt).getTime())}
              </span>
            ) : null}
            <span>Runs: {task.runCount}</span>
          </div>
        </div>

        {/* Prompt preview / edit */}
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
            <SectionLabel as="span">
              Prompt
            </SectionLabel>
          </button>
          {promptExpanded ? (
            editing ? (
              <textarea
                className={`${textareaClass} mt-2 min-h-[8rem]`}
                value={editPrompt}
                onChange={(e) => setField("prompt", e.target.value)}
                placeholder="Task prompt..."
                rows={6}
              />
            ) : (
              <pre className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border/60 bg-card/50 p-2 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                {task.prompt}
              </pre>
            )
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
          <SectionLabel>
            Run History
          </SectionLabel>

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
            <div className="mt-2 flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-[10px] text-destructive">
              <span className="flex-1">{runsError}</span>
              <button
                type="button"
                className="shrink-0 rounded border border-destructive/40 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] transition hover:bg-destructive/20"
                onClick={() => void loadRuns(task.cronJobId)}
              >
                Retry
              </button>
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
