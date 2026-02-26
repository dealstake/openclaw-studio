"use client";

import { memo, useMemo } from "react";
import { Calendar } from "lucide-react";
import type { StudioTask } from "@/features/tasks/types";
import { SectionLabel } from "@/components/SectionLabel";
import { computeUpcomingRuns } from "@/features/tasks/lib/upcomingRuns";
import { formatRelativeTime } from "@/lib/text/time";

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskUpcomingRunsProps {
  task: StudioTask;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRunTime(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskUpcomingRuns = memo(function TaskUpcomingRuns({
  task,
}: TaskUpcomingRunsProps) {
  const runs = useMemo(
    () => (task.enabled ? computeUpcomingRuns(task.schedule, 4) : []),
    [task.enabled, task.schedule]
  );

  if (!task.enabled || runs.length === 0) return null;

  return (
    <div className="border-b border-border/40 px-4 py-3">
      <SectionLabel className="mb-2">
        <Calendar className="mr-1 inline-block h-3 w-3" aria-hidden="true" />
        Upcoming Runs
      </SectionLabel>
      <ul className="space-y-1" aria-label="Upcoming scheduled runs">
        {runs.map((runMs, i) => (
          <li
            key={runMs}
            className="flex items-center justify-between text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  i === 0 ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
              {formatRunTime(runMs)}
            </span>
            <span className="text-[10px] tabular-nums opacity-70">
              {formatRelativeTime(runMs)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});
