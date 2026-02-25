/**
 * Shared display utilities for activity components.
 * Extracted from ActivityPanel.tsx to enable reuse.
 */

import type { LucideIcon } from "lucide-react";
import { Zap, Search, Microscope, Eye, HeartPulse, Bot, Activity } from "lucide-react";

/** Lucide icon for a task name. Returns icon component + optional color class. */
export function taskIcon(taskName: string): { icon: LucideIcon; className: string } {
  const lower = taskName.toLowerCase();
  if (lower.includes("continuation")) return { icon: Zap, className: "text-amber-400" };
  if (lower.includes("auditor") || lower.includes("audit")) return { icon: Search, className: "text-blue-400" };
  if (lower.includes("research")) return { icon: Microscope, className: "text-purple-400" };
  if (lower.includes("visual qa") || lower.includes("visual-qa")) return { icon: Eye, className: "text-emerald-400" };
  if (lower.includes("health") || lower.includes("gateway")) return { icon: HeartPulse, className: "text-red-400" };
  if (lower.includes("heartbeat")) return { icon: Activity, className: "text-cyan-400" };
  return { icon: Bot, className: "text-muted-foreground" };
}

/**
 * @deprecated Use `taskIcon()` instead — returns Lucide icon components per architecture policy.
 */
export function taskEmoji(taskName: string): string {
  const lower = taskName.toLowerCase();
  if (lower.includes("continuation")) return "⚡";
  if (lower.includes("auditor") || lower.includes("audit")) return "🔍";
  if (lower.includes("research")) return "🔬";
  if (lower.includes("visual qa") || lower.includes("visual-qa")) return "👁";
  if (lower.includes("health") || lower.includes("gateway")) return "🏥";
  return "🤖";
}

/** Status → dot color mapping. Keys match both store and TypeScript types. */
export const STATUS_COLORS: Record<string, string> = {
  streaming: "bg-emerald-400",
  complete: "bg-muted-foreground/30",
  error: "bg-red-400",
};

/** Status pill config for history events */
export const STATUS_PILL: Record<string, { bg: string; label: string }> = {
  success: { bg: "bg-emerald-500/15 text-emerald-400", label: "Success" },
  error: { bg: "bg-red-500/15 text-red-400", label: "Error" },
  partial: { bg: "bg-amber-500/15 text-amber-400", label: "Partial" },
};

/** Format a timestamp as HH:MM */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });

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
