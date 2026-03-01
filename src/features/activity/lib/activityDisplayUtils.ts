/**
 * Shared display utilities for activity components.
 * Extracted from ActivityPanel.tsx to enable reuse.
 */

import type { LucideIcon } from "lucide-react";
import { Zap, Search, Microscope, Eye, HeartPulse, Bot, Activity } from "lucide-react";

/** Icon config for task name keyword matching. Order matters — first match wins. */
const TASK_ICON_MAP: { keyword: string; icon: LucideIcon; className: string }[] = [
  { keyword: "continuation", icon: Zap, className: "text-amber-300" },
  { keyword: "auditor", icon: Search, className: "text-blue-400" },
  { keyword: "audit", icon: Search, className: "text-blue-400" },
  { keyword: "research", icon: Microscope, className: "text-purple-400" },
  { keyword: "visual qa", icon: Eye, className: "text-emerald-300" },
  { keyword: "visual-qa", icon: Eye, className: "text-emerald-300" },
  { keyword: "health", icon: HeartPulse, className: "text-red-300" },
  { keyword: "gateway", icon: HeartPulse, className: "text-red-300" },
  { keyword: "heartbeat", icon: Activity, className: "text-cyan-400" },
];

const DEFAULT_TASK_ICON = { icon: Bot, className: "text-muted-foreground" } as const;

/** Lucide icon for a task name. Returns icon component + color class. */
export function taskIcon(taskName: string): { icon: LucideIcon; className: string } {
  const lower = taskName.toLowerCase();
  const match = TASK_ICON_MAP.find((entry) => lower.includes(entry.keyword));
  return match ? { icon: match.icon, className: match.className } : DEFAULT_TASK_ICON;
}

/** Status → dot color mapping. Keys match both store and TypeScript types. */
export const STATUS_COLORS: Record<string, string> = {
  streaming: "bg-emerald-400",
  complete: "bg-muted-foreground/30",
  error: "bg-red-400",
};

/** Status pill config for history events */
export const STATUS_PILL: Record<string, { bg: string; label: string }> = {
  success: { bg: "bg-emerald-500/15 text-emerald-300", label: "Success" },
  error: { bg: "bg-red-500/15 text-red-300", label: "Error" },
  partial: { bg: "bg-amber-500/15 text-amber-300", label: "Partial" },
};

/** Format a timestamp as HH:MM */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "narrow" });

/** Success rate → text color class. Shared by CronJobRankingTable and any future job displays. */
export function successRateColor(rate: number): string {
  if (rate >= 0.9) return "text-green-400";
  if (rate >= 0.7) return "text-amber-300";
  return "text-red-400";
}

/** Run status → dot bg color class. Covers "ok", "error", and fallback. */
export function runStatusDot(status: string): string {
  if (status === "ok") return "bg-green-500";
  if (status === "error") return "bg-red-500";
  return "bg-muted-foreground";
}

/** Format an ISO timestamp string as relative time (e.g. "5 min. ago", "2 days ago", "Feb 12") */
export function formatHistoryTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return rtf.format(-diffDay, "day");
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
