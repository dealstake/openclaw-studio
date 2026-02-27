"use client";

import { createContext, useContext, useMemo } from "react";
import type { UpdateTaskPayload, TaskSchedule } from "@/features/tasks/types";

interface TaskActionsContextValue {
  onToggle: (taskId: string, enabled: boolean) => void;
  onUpdateTask: (taskId: string, updates: UpdateTaskPayload) => void;
  onUpdateSchedule: (taskId: string, schedule: TaskSchedule) => void;
  onRun: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

const TaskActionsContext = createContext<TaskActionsContextValue | null>(null);

export function useTaskActions(): TaskActionsContextValue {
  const ctx = useContext(TaskActionsContext);
  if (!ctx) throw new Error("useTaskActions must be used within TaskActionsProvider");
  return ctx;
}

interface TaskActionsProviderProps extends TaskActionsContextValue {
  children: React.ReactNode;
}

export function TaskActionsProvider({
  children,
  onToggle,
  onUpdateTask,
  onUpdateSchedule,
  onRun,
  onDelete,
}: TaskActionsProviderProps) {
  const value = useMemo(
    () => ({ onToggle, onUpdateTask, onUpdateSchedule, onRun, onDelete }),
    [onToggle, onUpdateTask, onUpdateSchedule, onRun, onDelete],
  );
  return (
    <TaskActionsContext.Provider value={value}>
      {children}
    </TaskActionsContext.Provider>
  );
}
