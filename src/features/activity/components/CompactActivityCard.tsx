"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityStatus = "running" | "completed" | "error" | "partial";

export interface CompactActivityCardProps {
  icon: string;
  title: string;
  subtitle: string;
  status: ActivityStatus;
  elapsed?: string;
  badge?: string;
  onExpand?: () => void;
}

const statusStyles: Record<ActivityStatus, string> = {
  running: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  partial: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

const statusLabels: Record<ActivityStatus, string> = {
  running: "Running",
  completed: "Done",
  error: "Failed",
  partial: "Partial",
};

export const CompactActivityCard = React.memo(function CompactActivityCard({
  icon,
  title,
  subtitle,
  status,
  elapsed,
  badge,
  onExpand,
}: CompactActivityCardProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2",
        "text-left transition-colors hover:bg-card/80",
        "group cursor-pointer"
      )}
    >
      <span className="shrink-0 text-base leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-foreground">
            {title}
          </span>
          {badge && (
            <span className={cn(
              "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium",
              status === "running"
                ? "animate-pulse bg-emerald-500/15 text-emerald-400"
                : "bg-primary/10 text-primary"
            )}>
              {badge}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-tight",
          statusStyles[status]
        )}
      >
        {statusLabels[status]}
      </span>
      {elapsed && (
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {elapsed}
        </span>
      )}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
});
