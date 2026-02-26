"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Check, Clock, Pencil, X } from "lucide-react";
import type { TaskSchedule } from "@/features/tasks/types";
import {
  PERIODIC_INTERVAL_OPTIONS,
  CONSTANT_INTERVAL_OPTIONS,
  STAGGER_OPTIONS,
} from "@/features/tasks/types";
import { humanReadableSchedule } from "@/features/tasks/lib/schedule";

// ─── Next-run preview helper ─────────────────────────────────────────────────

function computeNextRunPreview(schedule: TaskSchedule): string | null {
  if (schedule.type !== "periodic" && schedule.type !== "constant") return null;
  const ms = schedule.intervalMs;
  if (!ms || ms <= 0) return null;

  // Approximate next run from now + interval (matches gateway behaviour for
  // periodic/constant: next = lastRun + interval, but for preview we use now).
  const next = new Date(Date.now() + ms);
  const hh = String(next.getHours()).padStart(2, "0");
  const mm = String(next.getMinutes()).padStart(2, "0");

  if (ms >= 86_400_000) {
    const month = next.toLocaleString("en-US", { month: "short" });
    return `Next run ~${month} ${next.getDate()} at ${hh}:${mm}`;
  }
  return `Next run ~${hh}:${mm}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskScheduleEditorProps {
  schedule: TaskSchedule;
  busy: boolean;
  onSave: (schedule: TaskSchedule) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskScheduleEditor = memo(function TaskScheduleEditor({
  schedule,
  busy,
  onSave,
}: TaskScheduleEditorProps) {
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [draftIntervalMs, setDraftIntervalMs] = useState(
    schedule.type === "periodic" || schedule.type === "constant"
      ? schedule.intervalMs
      : 0,
  );
  const [draftStaggerMs, setDraftStaggerMs] = useState(
    schedule.type === "periodic" || schedule.type === "constant"
      ? (schedule.staggerMs ?? 0)
      : 0,
  );

  const isIntervalSchedule =
    schedule.type === "periodic" || schedule.type === "constant";

  const startEditing = useCallback(() => {
    if (!isIntervalSchedule) return;
    const s = schedule as { intervalMs: number; staggerMs?: number };
    setDraftIntervalMs(s.intervalMs);
    setDraftStaggerMs(s.staggerMs ?? 0);
    setEditingSchedule(true);
  }, [schedule, isIntervalSchedule]);

  const cancelEditing = useCallback(() => {
    setEditingSchedule(false);
  }, []);

  const hasChanges = useMemo(() => {
    if (!isIntervalSchedule) return false;
    const s = schedule as { intervalMs: number; staggerMs?: number };
    return (
      draftIntervalMs !== s.intervalMs ||
      draftStaggerMs !== (s.staggerMs ?? 0)
    );
  }, [schedule, isIntervalSchedule, draftIntervalMs, draftStaggerMs]);

  const handleSave = useCallback(() => {
    if (!hasChanges) {
      setEditingSchedule(false);
      return;
    }
    const newSchedule: TaskSchedule =
      schedule.type === "constant"
        ? {
            type: "constant",
            intervalMs: draftIntervalMs,
            ...(draftStaggerMs ? { staggerMs: draftStaggerMs } : {}),
          }
        : {
            type: "periodic",
            intervalMs: draftIntervalMs,
            ...(draftStaggerMs ? { staggerMs: draftStaggerMs } : {}),
          };
    onSave(newSchedule);
    setEditingSchedule(false);
  }, [schedule.type, draftIntervalMs, draftStaggerMs, hasChanges, onSave]);

  // Build preview from draft schedule
  const nextRunPreview = useMemo(() => {
    if (!editingSchedule) return null;
    const draftSchedule: TaskSchedule =
      schedule.type === "constant"
        ? { type: "constant", intervalMs: draftIntervalMs, ...(draftStaggerMs ? { staggerMs: draftStaggerMs } : {}) }
        : { type: "periodic", intervalMs: draftIntervalMs, ...(draftStaggerMs ? { staggerMs: draftStaggerMs } : {}) };
    return computeNextRunPreview(draftSchedule);
  }, [editingSchedule, schedule.type, draftIntervalMs, draftStaggerMs]);

  const intervalOptions =
    schedule.type === "constant"
      ? CONSTANT_INTERVAL_OPTIONS
      : PERIODIC_INTERVAL_OPTIONS;

  // ─── Non-interval schedules: read-only display ───────────────────────────
  if (!isIntervalSchedule) {
    return (
      <div className="mt-2 text-[11px] text-muted-foreground">
        {humanReadableSchedule(schedule)}
      </div>
    );
  }

  // ─── Read mode: show human schedule + edit button ────────────────────────
  if (!editingSchedule) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">
          {humanReadableSchedule(schedule)}
        </span>
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
          onClick={startEditing}
          disabled={busy}
          aria-label="Edit schedule"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // ─── Edit mode: dropdowns + preview + Save/Cancel ────────────────────────
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
        <select
          aria-label="Task schedule interval"
          className="h-7 rounded-md border border-primary/40 bg-card/70 px-2 font-mono text-[11px] text-foreground outline-none transition hover:border-primary/60 focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
          value={draftIntervalMs}
          disabled={busy}
          onChange={(e) => setDraftIntervalMs(Number(e.target.value))}
        >
          {intervalOptions.map((opt) => (
            <option key={opt.ms} value={opt.ms}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Task stagger window"
          className="h-7 rounded-md border border-primary/40 bg-card/70 px-2 font-mono text-[11px] text-foreground outline-none transition hover:border-primary/60 focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
          value={draftStaggerMs}
          disabled={busy}
          onChange={(e) => setDraftStaggerMs(Number(e.target.value))}
        >
          {STAGGER_OPTIONS.map((opt) => (
            <option key={opt.ms} value={opt.ms}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Save / Cancel */}
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleSave}
          disabled={busy || !hasChanges}
          aria-label="Save schedule"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:bg-muted/65 hover:text-foreground"
          onClick={cancelEditing}
          aria-label="Cancel schedule editing"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Next run preview */}
      {nextRunPreview ? (
        <p className="pl-5 text-[10px] text-muted-foreground/70">
          {nextRunPreview}
        </p>
      ) : null}
    </div>
  );
});
