"use client";

import React from "react";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { ContextPanel } from "@/features/context/components/ContextPanel";
import type { ContextTab } from "@/features/context/components/ContextPanel";
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

export type ExpandableTab = "projects" | "tasks" | "workspace" | "skills" | "activity" | "budget" | "router" | "playground" | "orchestrator" | "memory-graph" | "feedback";

interface StudioContextDrawerProps {
  isMobileLayout: boolean;
  showContextInline: boolean;
  mobilePane: string;
  swipeDy: number;
  /**
   * When "panel", renders without any fixed/absolute positioning — the parent
   * PanelGroup handles geometry. Used on wide viewports with react-resizable-panels.
   */
  renderMode?: "overlay" | "panel";
  swipeHandlers: {
    onTouchStart?: React.TouchEventHandler;
    onTouchMove?: React.TouchEventHandler;
    onTouchEnd?: React.TouchEventHandler;
  };
  contextTab: ContextTab;
  expandedTab: ExpandableTab | null;
  onExpandToggle: () => void;
  onClose: () => void;
  onTabChange: (tab: ContextTab) => void;
  switchToChat: () => void;
  hideTabBar: boolean;
  // Projects
  focusedAgentId: string | null;
  client: GatewayClient;
  cronEventTick: number;
  createProjectTick: number;
  // Tasks — use inline types matching what TasksPanel + useAgentTasks expose
  agentTasks: Parameters<typeof TasksPanel>[0]["tasks"];
  tasksLoading: boolean;
  tasksError: string | null;
  busyTaskId: string | null;
  busyAction: "toggle" | "run" | "delete" | "update" | null;
  onToggleTask: (taskId: string, enabled: boolean) => void;
  onUpdateTask: Parameters<typeof TasksPanel>[0]["onUpdateTask"];
  onUpdateTaskSchedule: Parameters<typeof TasksPanel>[0]["onUpdateSchedule"];
  onRunTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onRefreshTasks: () => void;
  onNewTask: () => void;
  cronMaxConcurrentRuns: number | undefined;
  status: GatewayStatus;
  agents: AgentState[];
  gatewayModels: GatewayModelChoice[];
  // Workspace
  focusedAgent: AgentState | null;
  // Wizard entry points
  onCreateSkill?: () => void;
}

export const StudioContextDrawer = React.memo(function StudioContextDrawer(props: StudioContextDrawerProps) {
  const {
    isMobileLayout, showContextInline, mobilePane, swipeDy, swipeHandlers,
    contextTab, expandedTab, onExpandToggle, onClose, onTabChange,
    switchToChat, hideTabBar, renderMode = "overlay",
    focusedAgentId, client, cronEventTick, createProjectTick,
    agentTasks, tasksLoading, tasksError, busyTaskId, busyAction,
    onToggleTask, onUpdateTask, onUpdateTaskSchedule, onRunTask, onDeleteTask,
    onRefreshTasks, onNewTask, cronMaxConcurrentRuns,
    status, agents, gatewayModels,
    focusedAgent,
    onCreateSkill,
  } = props;

  // Panel mode: no positioning/sizing — parent PanelGroup handles it
  const containerClassName = renderMode === "panel"
    ? "h-full w-full pt-14 min-h-0 overflow-hidden p-0"
    : isMobileLayout
      ? `fixed inset-x-0 bottom-0 z-50 h-[70vh] rounded-t-3xl transform-gpu ${swipeDy > 0 ? "" : "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"} ${mobilePane === "context" ? "translate-y-0" : "translate-y-full"} bg-surface-elevated/95 backdrop-blur-xl ring-1 ring-white/[0.06] border-t border-border/50 min-h-0 overflow-hidden p-0 shadow-[0_-4px_24px_-6px_rgba(0,0,0,0.3)]`
      : `fixed inset-y-0 right-0 z-20 w-[300px] lg:w-[360px] pt-4 min-[1440px]:pt-20 pb-16 lg:pb-0 transform-gpu transition-transform duration-300 ease-out ${showContextInline ? "translate-x-0" : "translate-x-full"} bg-surface-elevated/60 backdrop-blur-xl ring-1 ring-white/[0.06] min-h-0 overflow-hidden p-0 shadow-[-4px_0_24px_-6px_rgba(0,0,0,0.3)]`;

  return (
    <div
      className={containerClassName}
      style={isMobileLayout && swipeDy > 0 && renderMode !== "panel" ? { transform: `translateY(${swipeDy}px)` } : undefined}
      onTouchStart={isMobileLayout && renderMode !== "panel" ? swipeHandlers.onTouchStart : undefined}
      onTouchMove={isMobileLayout && renderMode !== "panel" ? swipeHandlers.onTouchMove : undefined}
      onTouchEnd={isMobileLayout && renderMode !== "panel" ? swipeHandlers.onTouchEnd : undefined}
    >
      {isMobileLayout && (
        <div className="flex justify-center py-5 cursor-grab active:cursor-grabbing" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
      )}
      <ContextPanel
        activeTab={contextTab}
        expandedTab={expandedTab}
        onExpandToggle={onExpandToggle}
        onClose={showContextInline ? onClose : switchToChat}
        onTabChange={onTabChange}
        hideTabBar={hideTabBar}
        projectsContent={
          <PanelErrorBoundary name="Projects">
            <div className="flex h-full w-full flex-col overflow-y-auto">
              <ProjectsPanel
                agentId={focusedAgentId}
                client={client}
                isTabActive={contextTab === "projects"}
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
              isTabActive={contextTab === "workspace"}
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
              isTabActive={contextTab === "playground"}
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
              isTabActive={contextTab === "orchestrator"}
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
    </div>
  );
});
