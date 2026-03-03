"use client";

import { memo } from "react";
import type { ContextTab } from "@/features/context/components/ContextPanel";
import { CONTEXT_TAB_CONFIG } from "@/features/context/lib/tabs";
import { PanelExpandModal } from "@/components/PanelExpandModal";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { ExpandedContext } from "@/features/context/lib/expandedContext";
import { ManagementPanelContent } from "@/components/ManagementPanelContent";
import { ProjectsPanel } from "@/features/projects/components/ProjectsPanel";
import { TasksPanel } from "@/features/tasks/components/TasksPanel";
import { UnifiedFilesPanel } from "@/features/workspace/components/UnifiedFilesPanel";
import { ActivityPanel } from "@/features/activity/components/ActivityPanel";
import { SkillsPanel } from "@/features/skills/components/SkillsPanel";
import { ContextBudgetCard } from "@/features/context-budget";
import type { ManagementTab } from "@/layout/AppSidebar";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { StudioTask, UpdateTaskPayload, TaskSchedule } from "@/features/tasks/types";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { PlaygroundPanel } from "@/features/playground/components/PlaygroundPanel";
import { RoutingPanel } from "@/features/routing/components/RoutingPanel";
import { OrchestratorPanel } from "@/features/orchestrator/components/OrchestratorPanel";
import { FeedbackPanel } from "@/features/feedback/components/FeedbackPanel";

interface StudioExpandedPanelProps {
  expandedTab: ContextTab | ManagementTab | null;
  onClose: () => void;
  focusedAgentId: string | null;
  client: GatewayClient;
  status: GatewayStatus;
  cronEventTick: number;
  createProjectTick: number;
  // Tasks
  agentTasks: StudioTask[];
  tasksLoading: boolean;
  tasksError: string | null;
  busyTaskId: string | null;
  busyAction: "toggle" | "run" | "delete" | "update" | null;
  onToggleTask: (taskId: string, enabled: boolean) => void;
  onUpdateTask: (taskId: string, updates: UpdateTaskPayload) => void;
  onUpdateTaskSchedule: (taskId: string, schedule: TaskSchedule) => Promise<void>;
  onRunTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRefreshTasks: () => void;
  onNewTask: () => void;
  cronMaxConcurrentRuns: number | undefined;
  agents: AgentState[];
  // Transcript
  onTranscriptClick: (sessionId: string, agentId: string | null) => void;
  // Playground
  gatewayModels: GatewayModelChoice[];
  defaultModel?: string;
  // Wizard entry points
  onCreateSkill?: () => void;
  // Cross-tab navigation
  onNavigateToPlayground?: (model: string) => void;
}

export const StudioExpandedPanel = memo(function StudioExpandedPanel({
  expandedTab,
  onClose,
  focusedAgentId,
  client,
  status,
  cronEventTick,
  createProjectTick,
  agentTasks,
  tasksLoading,
  tasksError,
  busyTaskId,
  busyAction,
  onToggleTask,
  onUpdateTask,
  onUpdateTaskSchedule,
  onRunTask,
  onDeleteTask,
  onRefreshTasks,
  onNewTask,
  cronMaxConcurrentRuns,
  agents,
  onTranscriptClick,
  gatewayModels = [],
  defaultModel,
  onCreateSkill,
  onNavigateToPlayground,
}: StudioExpandedPanelProps) {
  if (!expandedTab) return null;

  const title = CONTEXT_TAB_CONFIG.find((t) => t.value === expandedTab)?.label
    ?? ({ usage: "Usage", channels: "Channels", cron: "Cron", settings: "Settings" } as Record<string, string>)[expandedTab]
    ?? "";

  return (
    <PanelExpandModal open onOpenChange={onClose} title={title}>
      <ExpandedContext.Provider value={true}>
        <div className="flex h-full w-full flex-col overflow-y-auto">
          {expandedTab === "projects" && (
            <PanelErrorBoundary name="Projects">
              <ProjectsPanel agentId={focusedAgentId} client={client} isTabActive eventTick={cronEventTick} requestCreateProject={createProjectTick} />
            </PanelErrorBoundary>
          )}
          {expandedTab === "tasks" && (
            <PanelErrorBoundary name="Tasks">
              <TasksPanel
                isSelected
                client={client}
                tasks={agentTasks}
                loading={tasksLoading}
                error={tasksError}
                busyTaskId={busyTaskId}
                busyAction={busyAction}
                onToggle={onToggleTask}
                onUpdateTask={onUpdateTask}
                onUpdateSchedule={onUpdateTaskSchedule}
                onRun={onRunTask}
                onDelete={onDeleteTask}
                onRefresh={onRefreshTasks}
                onNewTask={onNewTask}
                maxConcurrentRuns={cronMaxConcurrentRuns}
              />
            </PanelErrorBoundary>
          )}
          {expandedTab === "workspace" && (
            <PanelErrorBoundary name="Workspace">
              <UnifiedFilesPanel
                client={client}
                agentId={focusedAgentId}
                isTabActive
                eventTick={cronEventTick}
              />
            </PanelErrorBoundary>
          )}
          {expandedTab === "skills" && (
            <PanelErrorBoundary name="Skills">
              <SkillsPanel client={client} status={status} onCreateSkill={onCreateSkill} />
            </PanelErrorBoundary>
          )}
          {expandedTab === "activity" && (
            <PanelErrorBoundary name="Activity">
              <ActivityPanel />
            </PanelErrorBoundary>
          )}
          {expandedTab === "budget" && (
            <PanelErrorBoundary name="Budget">
              <ContextBudgetCard agentId={focusedAgentId} client={client} status={status} />
            </PanelErrorBoundary>
          )}
          {expandedTab === "playground" && (
            <PanelErrorBoundary name="Playground">
              <PlaygroundPanel
                client={client}
                status={status}
                agentId={focusedAgentId}
                agentModel={agents.find((a) => a.agentId === focusedAgentId)?.model ?? null}
                models={gatewayModels}
                defaultModel={defaultModel}
                isTabActive
              />
            </PanelErrorBoundary>
          )}
          {expandedTab === "router" && (
            <PanelErrorBoundary name="Router">
              <RoutingPanel
                client={client}
                status={status}
                models={gatewayModels}
                agents={agents}
                onTestInPlayground={onNavigateToPlayground}
              />
            </PanelErrorBoundary>
          )}
          {expandedTab === "orchestrator" && (
            <PanelErrorBoundary name="Swarm Orchestrator">
              <OrchestratorPanel
                client={client}
                status={status}
                agentId={focusedAgentId}
                isTabActive
              />
            </PanelErrorBoundary>
          )}
          {expandedTab === "feedback" && (
            <PanelErrorBoundary name="Feedback">
              <FeedbackPanel />
            </PanelErrorBoundary>
          )}
          <ManagementPanelContent
            tab={expandedTab === "usage" || expandedTab === "channels" || expandedTab === "settings" ? expandedTab : null}
            onCloseSettings={onClose}
            onTranscriptClick={onTranscriptClick}
          />
        </div>
      </ExpandedContext.Provider>
    </PanelExpandModal>
  );
});
