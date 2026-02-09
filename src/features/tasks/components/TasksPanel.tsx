"use client";

import { memo } from "react";

interface TasksPanelProps {
  isSelected: boolean;
}

export const TasksPanel = memo(function TasksPanel({ isSelected }: TasksPanelProps) {
  if (!isSelected) return null;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="console-title text-2xl leading-none text-foreground">
          Tasks
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-6">
        <div className="text-center">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Coming Soon
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Task management and workflow automation.
          </p>
        </div>
      </div>
    </div>
  );
});
