"use client";

import { memo, useCallback, useState } from "react";
import { Plus, RefreshCw, Zap, Clock, Calendar } from "lucide-react";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import { Skeleton } from "@/components/Skeleton";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { StudioTask, TaskType } from "@/features/tasks/types";
import { TaskCard } from "./TaskCard";
import { TaskDetailDrawer } from "./TaskDetailDrawer";

// ─── Filter tabs ─────────────────────────────────────────────────────────────

type FilterTab = "all" | TaskType;

const FILTER_TABS: Array<{ value: FilterTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "constant", label: "Constant" },
  { value: "periodic", label: "Periodic" },
  { value: "scheduled", label: "Scheduled" },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface TasksPanelProps {
  isSelected: boolean;
  client: GatewayClient;
  tasks: StudioTask[];
  loading: boolean;
  error: string | null;
  busyTaskId: string | null;
  onToggle: (taskId: string, enabled: boolean) => void;
  onRun: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onRefresh: () => void;
  onNewTask: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TasksPanel = memo(function TasksPanel({
  isSelected,
  client,
  tasks,
  loading,
  error,
  busyTaskId,
  onToggle,
  onRun,
  onDelete,
  onRefresh,
  onNewTask,
}: TasksPanelProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const handleSelect = useCallback((taskId: string) => {
    setSelectedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const handleDelete = useCallback(
    (taskId: string) => {
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      onDelete(taskId);
    },
    [onDelete, selectedTaskId]
  );

  if (!isSelected) return null;

  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
    : null;

  const filtered =
    filter === "all" ? tasks : tasks.filter((t) => t.type === filter);

  const counts: Record<FilterTab, number> = {
    all: tasks.length,
    constant: tasks.filter((t) => t.type === "constant").length,
    periodic: tasks.filter((t) => t.type === "periodic").length,
    scheduled: tasks.filter((t) => t.type === "scheduled").length,
  };

  // When a task is selected, show the detail drawer instead of the list
  if (selectedTask) {
    return (
      <TaskDetailDrawer
        task={selectedTask}
        client={client}
        busy={busyTaskId === selectedTask.id}
        onClose={handleCloseDrawer}
        onToggle={onToggle}
        onRun={onRun}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Tasks
          </div>
          {tasks.length > 0 ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
              {tasks.length}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="flex h-7 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            aria-label="Create new task"
            onClick={onNewTask}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]">
              New
            </span>
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            aria-label="Refresh tasks"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      {tasks.length > 0 ? (
        <div className="flex items-center gap-1 border-b border-border/30 px-4 py-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`rounded-md px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] transition ${
                filter === tab.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
              {counts[tab.value] > 0 ? (
                <span className="ml-1 opacity-60">{counts[tab.value]}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="mb-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </div>
        ) : null}

        {loading && tasks.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-md border border-border/80 bg-card/70 p-3 space-y-2"
              >
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-48" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !error && tasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Zap className="h-5 w-5 opacity-40" />
              <Clock className="h-5 w-5 opacity-40" />
              <Calendar className="h-5 w-5 opacity-40" />
            </div>
            <div className="text-center">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                No tasks yet
              </p>
              <p className="mt-1.5 max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
                Create automated tasks to have your agents monitor, report, and
                act on your behalf.
              </p>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary transition hover:bg-primary/20"
              onClick={onNewTask}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]">
                Create Task
              </span>
            </button>
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                busy={busyTaskId === task.id}
                selected={selectedTaskId === task.id}
                onSelect={handleSelect}
                onToggle={onToggle}
                onRun={onRun}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : null}

        {tasks.length > 0 && filtered.length === 0 && !loading ? (
          <EmptyStatePanel
            title={`No ${filter} tasks.`}
            compact
            className="w-full p-4 text-center text-xs"
          />
        ) : null}
      </div>
    </div>
  );
});
