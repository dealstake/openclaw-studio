import { Zap, Clock, Calendar } from "lucide-react";
import type { TaskType } from "@/features/tasks/types";
import type { StudioTask } from "@/features/tasks/types";

// ─── Type badge config (single source of truth) ─────────────────────────────

export const TYPE_CONFIG: Record<
  TaskType,
  { label: string; icon: typeof Zap; className: string }
> = {
  constant: {
    label: "Constant",
    icon: Zap,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  periodic: {
    label: "Periodic",
    icon: Clock,
    className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  },
  scheduled: {
    label: "Scheduled",
    icon: Calendar,
    className: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  },
};

// ─── Status helpers ──────────────────────────────────────────────────────────

export type TaskStatusKey = "running" | "active" | "paused" | "error";

export const STATUS_DOT_CLASS: Record<TaskStatusKey, string> = {
  running: "bg-purple-400 animate-pulse",
  active: "bg-emerald-400",
  paused: "bg-muted-foreground",
  error: "bg-destructive",
};

export const STATUS_PILL_CLASS: Record<TaskStatusKey, string> = {
  running: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  paused: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
};

export const STATUS_LABEL: Record<TaskStatusKey, string> = {
  running: "Running",
  active: "Active",
  paused: "Paused",
  error: "Error",
};

export function getTaskStatusKey(task: StudioTask): TaskStatusKey {
  if (task.runningAtMs) return "running";
  if (task.lastRunStatus === "error") return "error";
  return task.enabled ? "active" : "paused";
}
