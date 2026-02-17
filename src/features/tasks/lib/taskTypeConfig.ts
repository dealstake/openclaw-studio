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
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  periodic: {
    label: "Periodic",
    icon: Clock,
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  },
  scheduled: {
    label: "Scheduled",
    icon: Calendar,
    className: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  },
};

// ─── Status helpers ──────────────────────────────────────────────────────────

export type TaskStatusKey = "active" | "paused" | "error";

export const STATUS_DOT_CLASS: Record<TaskStatusKey, string> = {
  active: "bg-emerald-400",
  paused: "bg-muted-foreground",
  error: "bg-destructive",
};

export const STATUS_LABEL: Record<TaskStatusKey, string> = {
  active: "Active",
  paused: "Paused",
  error: "Error",
};

export function getTaskStatusKey(task: StudioTask): TaskStatusKey {
  if (task.lastRunStatus === "error") return "error";
  return task.enabled ? "active" : "paused";
}
