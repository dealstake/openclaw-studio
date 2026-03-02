import { memo } from "react";
import type { AssociatedTask } from "../lib/parseProject";

interface LinkedTaskRowProps {
  task: AssociatedTask;
  isProjectParked: boolean;
}

export const LinkedTaskRow = memo(function LinkedTaskRow({
  task,
  isProjectParked,
}: LinkedTaskRowProps) {
  const isPaused = isProjectParked && task.autoManage;
  return (
    <div className={`flex items-center gap-2 text-[10px] ${isPaused ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isPaused ? "bg-amber-400" : task.autoManage ? "bg-emerald-400" : "bg-zinc-500"
        }`}
        title={isPaused ? "Paused (project parked)" : task.autoManage ? "Auto-managed" : "Manual"}
      />
      <span className={`truncate ${isPaused ? "line-through" : ""}`}>{task.name}</span>
      {isPaused && (
        <span className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1 py-px font-sans text-[8px] text-amber-300">
          paused
        </span>
      )}
      <span className="ml-auto font-sans text-[8px] text-muted-foreground/50 truncate max-w-[80px]">
        {task.cronJobId}
      </span>
    </div>
  );
});
