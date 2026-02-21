"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Zap, Clock, Calendar, Search } from "lucide-react";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import { Skeleton } from "@/components/Skeleton";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { StudioTask, TaskType, TaskSchedule, UpdateTaskPayload } from "@/features/tasks/types";
import { TaskCard } from "./TaskCard";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PanelIconButton } from "@/components/PanelIconButton";
import { SectionLabel } from "@/components/SectionLabel";

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
  busyAction?: "toggle" | "run" | "delete" | "update" | null;
  onToggle: (taskId: string, enabled: boolean) => void;
  onUpdateTask: (taskId: string, updates: UpdateTaskPayload) => void;
  onUpdateSchedule: (taskId: string, schedule: TaskSchedule) => void;
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
  busyAction,
  onToggle,
  onUpdateTask,
  onUpdateSchedule,
  onRun,
  onDelete,
  onRefresh,
  onNewTask,
}: TasksPanelProps) {
  const [filter, setFilterRaw] = useState<FilterTab>("all");
  const [search, setSearchRaw] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const setFilter = useCallback((f: FilterTab) => {
    setFilterRaw(f);
    setFocusIndex(-1);
  }, []);

  const setSearch = useCallback((s: string) => {
    setSearchRaw(s);
    setFocusIndex(-1);
  }, []);

  const handleSelect = useCallback((taskId: string) => {
    setSelectedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const handleDeleteRequest = useCallback((taskId: string) => {
    setPendingDeleteId(taskId);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!pendingDeleteId) return;
    if (selectedTaskId === pendingDeleteId) setSelectedTaskId(null);
    onDelete(pendingDeleteId);
    setPendingDeleteId(null);
  }, [onDelete, pendingDeleteId, selectedTaskId]);

  const handleDeleteCancel = useCallback(() => {
    setPendingDeleteId(null);
  }, []);

  const counts = useMemo<Record<FilterTab, number>>(() => ({
    all: tasks.length,
    constant: tasks.filter((t) => t.type === "constant").length,
    periodic: tasks.filter((t) => t.type === "periodic").length,
    scheduled: tasks.filter((t) => t.type === "scheduled").length,
  }), [tasks]);

  const filtered = useMemo(() => {
    let result = filter === "all" ? tasks : tasks.filter((t) => t.type === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [tasks, filter, search]);

  // Keyboard navigation
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && focusIndex >= 0 && focusIndex < filtered.length) {
        e.preventDefault();
        handleSelect(filtered[focusIndex].id);
      }
    },
    [filtered, focusIndex, handleSelect],
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-task-card]");
    items[focusIndex]?.scrollIntoView({ block: "nearest" });
  }, [focusIndex]);

  if (!isSelected) return null;

  const pendingDeleteTask = pendingDeleteId
    ? tasks.find((t) => t.id === pendingDeleteId) ?? null
    : null;

  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
    : null;

  // When a task is selected, show the detail drawer instead of the list
  if (selectedTask) {
    return (
      <TaskDetailDrawer
        task={selectedTask}
        client={client}
        busy={busyTaskId === selectedTask.id}
        onClose={handleCloseDrawer}
        onToggle={onToggle}
        onUpdateTask={onUpdateTask}
        onUpdateSchedule={onUpdateSchedule}
        onRun={onRun}
        onDelete={handleDeleteRequest}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <SectionLabel>
            Tasks
          </SectionLabel>
          {tasks.length > 0 ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
              {tasks.length}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="flex h-7 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 text-primary transition focus-ring hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            aria-label="Create new task"
            onClick={onNewTask}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
              New
            </span>
          </button>
          <PanelIconButton
            aria-label="Refresh tasks"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </PanelIconButton>
        </div>
      </div>

      {/* Filter tabs */}
      {tasks.length > 0 ? (
        <div className="flex items-center gap-1 border-b border-border/30 px-4 py-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition focus-ring ${
                filter === tab.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
              {counts[tab.value] > 0 ? (
                <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold ${
                  filter === tab.value
                    ? "bg-primary/20 text-primary"
                    : "bg-muted-foreground/15 text-muted-foreground"
                }`}>
                  {counts[tab.value]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* Search */}
      {tasks.length > 0 ? (
        <div className="border-b border-border/30 px-4 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="h-7 w-full rounded-md border border-border/50 bg-muted/30 pl-7 pr-2 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>
      ) : null}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-safe">
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
              <SectionLabel as="p">
                No tasks yet
              </SectionLabel>
              <p className="mt-1.5 max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
                Create automated tasks to have your agents monitor, report, and
                act on your behalf.
              </p>
            </div>
            <button
              type="button"
              className="relative z-10 flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary transition focus-ring hover:bg-primary/20"
              onClick={onNewTask}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                Create Task
              </span>
            </button>
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <div
            ref={listRef}
            className="flex flex-col gap-2 outline-none"
            tabIndex={0}
            role="listbox"
            aria-label="Task list"
            onKeyDown={handleListKeyDown}
          >
            {filtered.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                busy={busyTaskId === task.id}
                busyAction={busyTaskId === task.id ? busyAction : null}
                selected={selectedTaskId === task.id}
                focused={focusIndex === i}
                onSelect={handleSelect}
                onToggle={onToggle}
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

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) handleDeleteCancel(); }}
        title="Delete task?"
        description={`This will stop "${pendingDeleteTask?.name ?? "this task"}" and remove all run history. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
});
