"use client";

/**
 * ContextPanelContent — Self-contained tabbed panel content.
 *
 * Imports all tab panels directly and assembles their content,
 * eliminating the need to thread 15+ content props through parent components.
 *
 * Used by:
 * - StudioContextDrawer (overlay/panel mode) on all viewports
 * - StudioExpandedPanel for full-screen expanded tab view
 */

import React, { useMemo } from "react";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { ContextPanel } from "./ContextPanel";
import { useHasLiveActivity } from "@/features/activity/hooks/useHasLiveActivity";
import type { ContextTab } from "../lib/tabs";
// ExpandableTab from useContextPanelState is wider (includes "usage"|"channels"|"personas").
// ContextPanel only accepts ContextTab for expandedTab.
import { ProjectsPanel } from "@/features/projects/components/ProjectsPanel";
import { TasksPanel } from "@/features/tasks/components/TasksPanel";
import { UnifiedFilesPanel } from "@/features/workspace/components/UnifiedFilesPanel";
import { ActivityPanel } from "@/features/activity/components/ActivityPanel";
import { SkillsPanel } from "@/features/skills/components/SkillsPanel";
import { ContextBudgetCard } from "@/features/context-budget";
import { RoutingPanel } from "@/features/routing/components/RoutingPanel";
import { PlaygroundPanel } from "@/features/playground/components/PlaygroundPanel";
import { OrchestratorPanel } from "@/features/orchestrator/components/OrchestratorPanel";
import { MemoryGraphPanel } from "@/features/memory-graph/components/MemoryGraphPanel";
import { FeedbackPanel } from "@/features/feedback/components/FeedbackPanel";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayModelChoice } from "@/lib/gateway/models";

type TasksPanelProps = React.ComponentProps<typeof TasksPanel>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextPanelContentProps {
  // Tab state
  activeTab: ContextTab;
  onTabChange: (tab: ContextTab) => void;
  expandedTab?: ContextTab | null;
  onExpandToggle?: () => void;
  onClose?: () => void;
  hideTabBar?: boolean;

  // Shared dependencies
  client: GatewayClient;
  status: GatewayStatus;
  focusedAgentId: string | null;
  focusedAgent: AgentState | null;

  // Projects
  cronEventTick: number;
  createProjectTick: number;

  // Tasks
  agentTasks: TasksPanelProps["tasks"];
  tasksLoading: boolean;
  tasksError: string | null;
  busyTaskId: string | null;
  busyAction: "toggle" | "run" | "delete" | "update" | null;
  onToggleTask: (taskId: string, enabled: boolean) => void;
  onUpdateTask: TasksPanelProps["onUpdateTask"];
  onUpdateTaskSchedule: TasksPanelProps["onUpdateSchedule"];
  onRunTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onRefreshTasks: () => void;
  onNewTask: () => void;
  cronMaxConcurrentRuns: number | undefined;

  // Models / agents (for playground, router)
  agents: AgentState[];
  gatewayModels: GatewayModelChoice[];

  // Wizard entry
  onCreateSkill?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ContextPanelContent = React.memo(function ContextPanelContent({
  activeTab,
  onTabChange,
  expandedTab,
  onExpandToggle,
  onClose,
  hideTabBar,
  client,
  status,
  focusedAgentId,
  focusedAgent,
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
  gatewayModels,
  onCreateSkill,
}: ContextPanelContentProps) {
  const hasLiveActivity = useHasLiveActivity();

  const tabBadges = useMemo(() => {
    if (!hasLiveActivity) return undefined;
    return {
      activity: (
        <span className="relative ml-1 inline-flex h-2 w-2" aria-label="Live activity">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      ),
    };
  }, [hasLiveActivity]);

  return (
    <ContextPanel
      activeTab={activeTab}
      tabBadges={tabBadges}
      expandedTab={expandedTab}
      onExpandToggle={onExpandToggle}
      onClose={onClose}
      onTabChange={onTabChange}
      hideTabBar={hideTabBar}
      projectsContent={
        <PanelErrorBoundary name="Projects">
          <div className="flex h-full w-full flex-col overflow-y-auto">
            <ProjectsPanel
              agentId={focusedAgentId}
              client={client}
              isTabActive={activeTab === "projects"}
              eventTick={cronEventTick}
              requestCreateProject={createProjectTick}
            />
          </div>
        </PanelErrorBoundary>
      }
      tasksContent={
        <PanelErrorBoundary name="Tasks">
          <div className="flex h-full w-full flex-col overflow-y-auto">
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
          </div>
        </PanelErrorBoundary>
      }
      workspaceContent={
        <PanelErrorBoundary name="Workspace">
          <UnifiedFilesPanel
            key={focusedAgent?.agentId ?? "none"}
            agentId={focusedAgent?.agentId ?? null}
            client={client}
            isTabActive={activeTab === "workspace"}
            eventTick={cronEventTick}
          />
        </PanelErrorBoundary>
      }
      skillsContent={
        <PanelErrorBoundary name="Skills">
          <SkillsPanel client={client} status={status} onCreateSkill={onCreateSkill} />
        </PanelErrorBoundary>
      }
      activityContent={
        <PanelErrorBoundary name="Activity">
          <ActivityPanel />
        </PanelErrorBoundary>
      }
      budgetContent={
        <PanelErrorBoundary name="Budget">
          <ContextBudgetCard agentId={focusedAgentId} client={client} status={status} />
        </PanelErrorBoundary>
      }
      playgroundContent={
        <PanelErrorBoundary name="Playground">
          <PlaygroundPanel
            client={client}
            status={status}
            agentId={focusedAgentId}
            agentModel={agents.find((a) => a.agentId === focusedAgentId)?.model ?? null}
            models={gatewayModels}
            defaultModel={undefined}
            isTabActive={activeTab === "playground"}
          />
        </PanelErrorBoundary>
      }
      routerContent={
        <PanelErrorBoundary name="Router">
          <RoutingPanel
            client={client}
            status={status}
            models={gatewayModels}
            agents={agents}
          />
        </PanelErrorBoundary>
      }
      orchestratorContent={
        <PanelErrorBoundary name="Swarm Orchestrator">
          <OrchestratorPanel
            client={client}
            status={status}
            agentId={focusedAgentId}
            isTabActive={activeTab === "orchestrator"}
          />
        </PanelErrorBoundary>
      }
      memoryGraphContent={
        <PanelErrorBoundary name="Memory Graph">
          <MemoryGraphPanel agentId={focusedAgentId} className="h-full" />
        </PanelErrorBoundary>
      }
      feedbackContent={
        <PanelErrorBoundary name="Feedback">
          <FeedbackPanel />
        </PanelErrorBoundary>
      }
    />
  );
});
