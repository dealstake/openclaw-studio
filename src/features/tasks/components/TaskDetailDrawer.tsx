"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTaskEditForm } from "@/features/tasks/hooks/useTaskEditForm";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { StudioTask } from "@/features/tasks/types";
import { type CronRunEntry, fetchCronRuns } from "@/lib/cron/types";
import { useTaskActions, TaskActionsProvider } from "@/features/tasks/context/TaskActionsContext";
import { TaskDetailHeader } from "./TaskDetailHeader";
import { TaskMetadataSection } from "./TaskMetadataSection";
import { TaskPromptSection } from "./TaskPromptSection";
import { TaskAdvancedSection } from "./TaskAdvancedSection";
import { RunHistorySection } from "./RunHistorySection";
import { RawGatewaySection } from "./RawGatewaySection";
import { TaskHealthSection } from "./TaskHealthSection";
import { TaskUpcomingRuns } from "./TaskUpcomingRuns";

// ─── Types ───────────────────────────────────────────────────────────────────

type DrawerTab = "overview" | "history" | "advanced";

const TAB_CONFIG: { key: DrawerTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "Run History" },
  { key: "advanced", label: "Advanced" },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskDetailDrawerProps {
  task: StudioTask | null;
  client: GatewayClient;
  busy: boolean;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskDetailDrawer = memo(function TaskDetailDrawer({
  task,
  client,
  busy,
  onClose,
}: TaskDetailDrawerProps) {
  const actions = useTaskActions();
  const { onUpdateTask } = actions;
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [pendingTrigger, setPendingTrigger] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>("overview");
  const loadingRef = useRef(false);

  const {
    editing, editName, editDescription, editPrompt, editModel,
    editThinking, editDeliveryChannel, editDeliveryTarget,
    startEditing: startEditingForm, cancelEditing, saveEdits, setField,
  } = useTaskEditForm({ task, onUpdateTask });

  const startEditing = useCallback(() => {
    startEditingForm();
    setActiveTab("overview");
  }, [startEditingForm]);

  const loadRuns = useCallback(
    async (cronJobId: string) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setRunsLoading(true);
      setRunsError(null);
      try {
        const entries = await fetchCronRuns(client, cronJobId, 20);
        setRuns(entries);
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          const message =
            err instanceof Error ? err.message : "Failed to load run history.";
          setRunsError(message);
        }
        setRuns([]);
      } finally {
        loadingRef.current = false;
        setRunsLoading(false);
      }
    },
    [client]
  );

  const handleRetryRuns = useCallback(() => {
    if (task) void loadRuns(task.cronJobId);
  }, [task, loadRuns]);

  const handleRun = useCallback(
    (taskId: string) => {
      actions.onRun(taskId);
      setPendingTrigger(true);
      setActiveTab("history");
      // Auto-refresh run history after trigger
      if (task) {
        setTimeout(() => {
          void loadRuns(task.cronJobId).then(() => setPendingTrigger(false));
        }, 3000);
      }
    },
    [actions, task, loadRuns]
  );

  useEffect(() => {
    if (!task) {
      setRuns([]);
      setRunsError(null);
      setPendingTrigger(false);
      setActiveTab("overview");
      cancelEditing();
      return;
    }
    void loadRuns(task.cronJobId);
  }, [task, loadRuns, cancelEditing]);

  if (!task) return null;

  return (
    <TaskActionsProvider
      onToggle={actions.onToggle}
      onUpdateTask={actions.onUpdateTask}
      onUpdateSchedule={actions.onUpdateSchedule}
      onRun={handleRun}
      onDelete={actions.onDelete}
    >
    <div className="flex h-full w-full flex-col overflow-hidden animate-in slide-in-from-right-8 fade-in duration-200">
      <TaskDetailHeader
        taskName={task.name}
        editing={editing}
        editName={editName}
        busy={busy}
        onEditNameChange={(v) => setField("name", v)}
        onStartEditing={startEditing}
        onSaveEdits={saveEdits}
        onCancelEditing={cancelEditing}
        onClose={onClose}
      />

      {/* Tab bar */}
      <div className="flex border-b border-border/40" role="tablist" aria-label="Task details">
        {TAB_CONFIG.map(({ key, label }) => (
          <button
            key={key}
            id={`task-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`task-panel-${key}`}
            className={`flex-1 px-3 py-2 text-xs font-medium transition ${
              activeTab === key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Overview tab */}
        {activeTab === "overview" ? (
          <div role="tabpanel" id="task-panel-overview" aria-labelledby="task-tab-overview">
            <TaskMetadataSection
              task={task}
              editing={editing}
              editDescription={editDescription}
              busy={busy}
              onFieldChange={setField}
            />
            <TaskPromptSection
              prompt={task.prompt}
              editing={editing}
              editPrompt={editPrompt}
              defaultExpanded={editing}
              onEditPromptChange={(v) => setField("prompt", v)}
            />
            <TaskHealthSection task={task} />
            <TaskUpcomingRuns task={task} />
          </div>
        ) : null}

        {/* Run History tab */}
        {activeTab === "history" ? (
          <div role="tabpanel" id="task-panel-history" aria-labelledby="task-tab-history">
          <RunHistorySection
            runs={runs}
            loading={runsLoading}
            error={runsError}
            pendingTrigger={pendingTrigger}
            onRetry={handleRetryRuns}
          />
          </div>
        ) : null}

        {/* Advanced tab */}
        {activeTab === "advanced" ? (
          <div role="tabpanel" id="task-panel-advanced" aria-labelledby="task-tab-advanced">
            <TaskAdvancedSection
              task={task}
              editing={editing}
              editModel={editModel}
              editThinking={editThinking}
              editDeliveryChannel={editDeliveryChannel}
              editDeliveryTarget={editDeliveryTarget}
              onFieldChange={setField}
            />
            <RawGatewaySection
              cronJob={task.rawCronJob}
              cronJobId={task.cronJobId}
            />
          </div>
        ) : null}
      </div>
    </div>
    </TaskActionsProvider>
  );
});
