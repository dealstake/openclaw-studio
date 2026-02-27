"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, ListChecks, Layers } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { StudioTask, TaskType, TaskSchedule, UpdateTaskPayload } from "@/features/tasks/types";
import { TaskCard } from "./TaskCard";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PanelIconButton } from "@/components/PanelIconButton";
import { SectionLabel } from "@/components/SectionLabel";
import { PanelToolbar } from "@/components/ui/PanelToolbar";
import { FilterGroup, type FilterGroupOption } from "@/components/ui/FilterGroup";


// ─── Filter tabs ─────────────────────────────────────────────────────────────

type FilterTab = "all" | TaskType | "orphan";

const MGMT_STATUS_FILTERS: FilterTab[] = ["orphan"];

const FILTER_OPTIONS: FilterGroupOption<FilterTab>[] = [
  { value: "all", label: "All" },
  { value: "constant", label: "Constant" },
  { value: "periodic", label: "Periodic" },
  { value: "scheduled", label: "Scheduled" },
  { value: "orphan", label: "Orphan" },
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
  maxConcurrentRuns?: number | null;
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
  maxConcurrentRuns,
}: TasksPanelProps) {
  const [filter, setFilterRaw] = useState<FilterTab[]>(["all"]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const setFilter = useCallback((next: FilterTab[]) => {
    if (next.length === 0) { setFilterRaw(["all"]); setFocusIndex(-1); return; }
    const hadAll = filter.includes("all");
    const hasAll = next.includes("all");
    if (hasAll && !hadAll) { setFilterRaw(["all"]); }
    else if (hasAll && next.length > 1) { setFilterRaw(next.filter((v) => v !== "all") as FilterTab[]); }
    else { setFilterRaw(next); }
    setFocusIndex(-1);
  }, [filter]);



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

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    if (!open) handleDeleteCancel();
  }, [handleDeleteCancel]);


  const isAllSelected = filter.includes("all");

  const filterOptionsWithCounts = useMemo<FilterGroupOption<FilterTab>[]>(() => {
    const counts: Partial<Record<FilterTab, number>> = {
      all: tasks.length,
      constant: tasks.filter((t) => t.type === "constant").length,
      periodic: tasks.filter((t) => t.type === "periodic").length,
      scheduled: tasks.filter((t) => t.type === "scheduled").length,

      orphan: tasks.filter((t) => t.managementStatus === "orphan").length,
    };
    // Only show orphan pills if count > 0
    return FILTER_OPTIONS.filter(
      (opt) => !MGMT_STATUS_FILTERS.includes(opt.value) || (counts[opt.value] ?? 0) > 0
    ).map((opt) => ({ ...opt, count: counts[opt.value] ?? 0 }));
  }, [tasks]);

  const filtered = useMemo(() => {
    let result: StudioTask[];
    if (isAllSelected) {
      result = tasks;
    } else {
      result = tasks.filter((t) => {
        for (const f of filter) {
          if (MGMT_STATUS_FILTERS.includes(f) && t.managementStatus === f) return true;
          if (!MGMT_STATUS_FILTERS.includes(f) && t.type === f) return true;
        }
        return false;
      });
    }
    return result;
  }, [tasks, filter, isAllSelected]);

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

  // Move DOM focus + scroll focused item into view
  useEffect(() => {
    if (focusIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>("[data-task-card]");
    const target = items[focusIndex];
    if (target) {
      target.focus({ preventScroll: false });
      target.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  // ─── Automated orphan detection ──────────────────────────────────────────
  const orphanCount = useMemo(
    () => tasks.filter((t) => t.managementStatus === "orphan").length,
    [tasks],
  );
  const orphanToastShown = useRef(false);
  useEffect(() => {
    if (orphanCount > 0 && !orphanToastShown.current && !loading) {
      orphanToastShown.current = true;
      toast.warning(
        `${orphanCount} orphaned task${orphanCount > 1 ? "s" : ""} detected — metadata exists but cron job is missing. Use the "Orphan" filter to review.`,
        { duration: 8000 },
      );
    }
    // Reset when orphans are resolved so toast fires again if new orphans appear
    if (orphanCount === 0) orphanToastShown.current = false;
  }, [orphanCount, loading]);

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
          {maxConcurrentRuns != null && (
            <TooltipProvider >
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    {maxConcurrentRuns}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Max {maxConcurrentRuns} concurrent cron runs
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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

      {/* Toolbar: filters + search */}
      {tasks.length > 0 ? (
        <PanelToolbar>
          <FilterGroup<FilterTab>
            options={filterOptionsWithCounts}
            value={filter}
            onChange={setFilter}
          />

        </PanelToolbar>
      ) : null}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-safe">
        {error ? (
          <div className="mb-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </div>
        ) : null}

        {loading && tasks.length === 0 ? (
          <CardSkeleton count={3} variant="card" />
        ) : null}

        {!loading && !error && tasks.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description="Create automated tasks to have your agents monitor, report, and act on your behalf."
            action={{ label: "Create Task", onClick: onNewTask }}
          />
        ) : null}

        {filtered.length > 0 ? (
          <div
            ref={listRef}
            className="flex flex-col gap-2 outline-none animate-in fade-in duration-300"
            tabIndex={0}
            role="listbox"
            aria-label="Task list"
            onKeyDown={handleListKeyDown}
          >
            {filtered.map((task, i) => (
              <div
                key={task.id}
                className="animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-both"
                style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
              >
                <TaskCard
                  task={task}
                  busy={busyTaskId === task.id}
                  busyAction={busyTaskId === task.id ? busyAction : null}
                  selected={selectedTaskId === task.id}
                  focused={focusIndex === i}
                  onSelect={handleSelect}
                  onToggle={onToggle}
                />
              </div>
            ))}
          </div>
        ) : null}

        {tasks.length > 0 && filtered.length === 0 && !loading ? (
          <EmptyState
            icon={ListChecks}
            title={`No ${filter} tasks`}
            className="py-8"
          />
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={handleDeleteDialogChange}
        title="Delete task?"
        description={`This will stop "${pendingDeleteTask?.name ?? "this task"}" and remove all run history. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
});
