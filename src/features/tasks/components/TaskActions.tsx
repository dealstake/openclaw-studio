"use client";

import { memo } from "react";
import { Play, Trash2 } from "lucide-react";
import type { ManagementStatus } from "@/features/tasks/types";
import { useTaskActions } from "@/features/tasks/context/TaskActionsContext";

interface TaskActionsProps {
  taskId: string;
  enabled: boolean;
  managementStatus: ManagementStatus;
  busy: boolean;
}

export const TaskActions = memo(function TaskActions({
  taskId,
  enabled,
  managementStatus,
  busy,
}: TaskActionsProps) {
  const { onToggle, onRun, onDelete } = useTaskActions();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-3">
      {managementStatus !== "orphan" ? (
        <>
          <button
            type="button"
            className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
              enabled
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            }`}
            onClick={() => onToggle(taskId, !enabled)}
            disabled={busy}
          >
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em]">
              {enabled ? "Pause" : "Resume"}
            </span>
          </button>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-card/70 px-2.5 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onRun(taskId)}
            disabled={busy}
          >
            <Play className="h-3 w-3" />
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em]">
              Trigger Run
            </span>
          </button>
        </>
      ) : null}
      <button
        type="button"
        className="flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-transparent px-2.5 text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => onDelete(taskId)}
        disabled={busy}
      >
        <Trash2 className="h-3 w-3" />
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em]">
          {managementStatus === "orphan" ? "Delete Metadata" : "Delete"}
        </span>
      </button>
    </div>
  );
});
