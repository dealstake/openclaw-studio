"use client";

import { memo } from "react";
import { X, ArrowLeft, Pencil, Save } from "lucide-react";
import { PanelIconButton } from "@/components/PanelIconButton";
import { SectionLabel } from "@/components/SectionLabel";
import { inputClass } from "@/features/tasks/lib/styles";

interface TaskDetailHeaderProps {
  taskName: string;
  editing: boolean;
  editName: string;
  busy: boolean;
  onEditNameChange: (value: string) => void;
  onStartEditing: () => void;
  onSaveEdits: () => void;
  onCancelEditing: () => void;
  onClose: () => void;
}

export const TaskDetailHeader = memo(function TaskDetailHeader({
  taskName,
  editing,
  editName,
  busy,
  onEditNameChange,
  onStartEditing,
  onSaveEdits,
  onCancelEditing,
  onClose,
}: TaskDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back to task list"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/50 hover:text-foreground md:hidden"
            onClick={onClose}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <SectionLabel>Task Detail</SectionLabel>
        </div>
        {editing ? (
          <input
            className={`${inputClass} mt-0.5 font-semibold`}
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            placeholder="Task name"
            autoFocus
          />
        ) : (
          <h2 className="mt-0.5 truncate font-mono text-sm font-semibold text-foreground">
            {taskName}
          </h2>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {editing ? (
          <>
            <button
              className="flex h-7 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              aria-label="Save changes"
              onClick={onSaveEdits}
              disabled={busy || !editName.trim()}
            >
              <Save className="h-3 w-3" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                Save
              </span>
            </button>
            <button
              className="flex h-7 items-center justify-center rounded-md border border-border/80 bg-card/70 px-2 text-muted-foreground transition hover:border-border hover:bg-muted/65"
              type="button"
              aria-label="Cancel editing"
              onClick={onCancelEditing}
            >
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                Cancel
              </span>
            </button>
          </>
        ) : (
          <>
            <PanelIconButton aria-label="Edit task" onClick={onStartEditing}>
              <Pencil className="h-3 w-3" />
            </PanelIconButton>
            <PanelIconButton aria-label="Close task detail" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </PanelIconButton>
          </>
        )}
      </div>
    </div>
  );
});
