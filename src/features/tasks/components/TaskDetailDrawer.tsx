"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTaskEditForm } from "@/features/tasks/hooks/useTaskEditForm";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { StudioTask, TaskSchedule, UpdateTaskPayload } from "@/features/tasks/types";
import { type CronRunEntry, fetchCronRuns } from "@/lib/cron/types";
import { TaskDetailHeader } from "./TaskDetailHeader";
import { TaskMetadataSection } from "./TaskMetadataSection";
import { TaskPromptSection } from "./TaskPromptSection";
import { RunHistorySection } from "./RunHistorySection";
import { RawGatewaySection } from "./RawGatewaySection";
import { ChevronRight, Settings2 } from "lucide-react";
import { sectionLabelClass } from "@/components/SectionLabel";

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskDetailDrawerProps {
  task: StudioTask | null;
  client: GatewayClient;
  busy: boolean;
  onClose: () => void;
  onToggle: (taskId: string, enabled: boolean) => void;
  onUpdateTask: (taskId: string, updates: UpdateTaskPayload) => void;
  onUpdateSchedule: (taskId: string, schedule: TaskSchedule) => void;
  onRun: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskDetailDrawer = memo(function TaskDetailDrawer({
  task,
  client,
  busy,
  onClose,
  onToggle,
  onUpdateTask,
  onUpdateSchedule,
  onRun,
  onDelete,
}: TaskDetailDrawerProps) {
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const loadingRef = useRef(false);

  const {
    editing, editName, editDescription, editPrompt, editModel,
    editThinking, editDeliveryChannel, editDeliveryTarget,
    startEditing: startEditingForm, cancelEditing, saveEdits, setField,
  } = useTaskEditForm({ task, onUpdateTask });

  const startEditing = useCallback(() => {
    startEditingForm();
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

  useEffect(() => {
    if (!task) {
      setRuns([]);
      setRunsError(null);
      cancelEditing();
      return;
    }
    void loadRuns(task.cronJobId);
  }, [task, loadRuns, cancelEditing]);

  if (!task) return null;

  return (
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TaskMetadataSection
          task={task}
          editing={editing}
          editDescription={editDescription}
          editModel={editModel}
          editThinking={editThinking}
          editDeliveryChannel={editDeliveryChannel}
          editDeliveryTarget={editDeliveryTarget}
          busy={busy}
          showAdvanced={advancedExpanded || editing}
          onFieldChange={setField}
          onUpdateSchedule={onUpdateSchedule}
          onToggle={onToggle}
          onRun={onRun}
          onDelete={onDelete}
        />

        <TaskPromptSection
          prompt={task.prompt}
          editing={editing}
          editPrompt={editPrompt}
          defaultExpanded={editing}
          onEditPromptChange={(v) => setField("prompt", v)}
        />

        {/* Advanced toggle — collapsed by default */}
        <div className="border-b border-border/40">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground hover:text-foreground transition"
            onClick={() => setAdvancedExpanded((prev) => !prev)}
            aria-expanded={advancedExpanded}
          >
            <ChevronRight
              className={`h-3 w-3 shrink-0 transition-transform duration-150 ${
                advancedExpanded ? "rotate-90" : ""
              }`}
            />
            <Settings2 className="h-3 w-3 shrink-0" />
            <span className={sectionLabelClass}>Advanced</span>
          </button>
          {advancedExpanded ? (
            <div className="animate-in fade-in slide-in-from-top-1 duration-150">
              <RawGatewaySection
                cronJob={task.rawCronJob}
                cronJobId={task.cronJobId}
              />
            </div>
          ) : null}
        </div>

        <RunHistorySection
          runs={runs}
          loading={runsLoading}
          error={runsError}
          onRetry={handleRetryRuns}
        />
      </div>
    </div>
  );
});
