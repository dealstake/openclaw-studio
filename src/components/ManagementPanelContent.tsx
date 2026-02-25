"use client";

import { lazy, memo, Suspense } from "react";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import type { ManagementTab } from "@/layout/AppSidebar";
import { ChannelsPanel } from "@/features/channels/components/ChannelsPanel";
import { useManagementPanel } from "@/components/management/ManagementPanelContext";

const SessionsPanel = lazy(() =>
  import("@/features/sessions/components/SessionsPanel").then((m) => ({
    default: m.SessionsPanel,
  }))
);
const UsagePanel = lazy(() =>
  import("@/features/usage/components/UsagePanel").then((m) => ({
    default: m.UsagePanel,
  }))
);
import {
  AgentSettingsPanel,
} from "@/features/agents/components/AgentInspectPanels";

const RESERVED_MAIN_AGENT_ID = "main";

export interface ManagementPanelContentProps {
  tab: ManagementTab | null;
  /** Override context onTranscriptClick for specific usage sites */
  onTranscriptClick?: (sessionId: string, agentId: string | null) => void;
  /** Override context onCloseSettings for specific usage sites */
  onCloseSettings?: () => void;
}

export const ManagementPanelContent = memo(function ManagementPanelContent({
  tab,
  onTranscriptClick: onTranscriptClickOverride,
  onCloseSettings: onCloseSettingsOverride,
}: ManagementPanelContentProps) {
  const ctx = useManagementPanel();

  const onTranscriptClick = onTranscriptClickOverride ?? ctx.onTranscriptClick;
  const onCloseSettings = onCloseSettingsOverride ?? ctx.onCloseSettings;

  if (!tab) return null;

  return (
    <Suspense fallback={null}>
      {tab === "sessions" && (
        <PanelErrorBoundary name="Sessions">
          <SessionsPanel
            client={ctx.client}
            agentId={ctx.focusedAgentId}
            sessions={ctx.allSessions}
            loading={ctx.allSessionsLoading}
            error={ctx.allSessionsError}
            onRefresh={ctx.onRefreshSessions}
            activeSessionKey={ctx.activeSessionKey}
            aggregateUsage={ctx.aggregateUsage}
            aggregateUsageLoading={ctx.aggregateUsageLoading}
            cumulativeUsage={ctx.cumulativeUsage}
            cumulativeUsageLoading={ctx.cumulativeUsageLoading}
            usageByType={ctx.usageByType}
            onViewTrace={ctx.onViewTrace}
            onTranscriptClick={onTranscriptClick}
          />
        </PanelErrorBoundary>
      )}
      {tab === "usage" && (
        <PanelErrorBoundary name="Usage">
          <UsagePanel client={ctx.client} status={ctx.status} />
        </PanelErrorBoundary>
      )}
      {tab === "channels" && (
        <PanelErrorBoundary name="Channels">
          <ChannelsPanel
            snapshot={ctx.channelsSnapshot}
            loading={ctx.channelsLoading}
            error={ctx.channelsError}
            onRefresh={ctx.onRefreshChannels}
            hideHeader
          />
        </PanelErrorBoundary>
      )}
      {tab === "settings" && ctx.settingsAgent && (
        <PanelErrorBoundary name="Settings">
          <AgentSettingsPanel
            key={ctx.settingsAgent.agentId}
            agent={ctx.settingsAgent}
            client={ctx.client}
            status={ctx.status}
            onClose={onCloseSettings}
            onRename={ctx.onRenameAgent}
            onNewSession={ctx.onNewSession}
            onDelete={ctx.onDeleteAgent}
            canDelete={ctx.settingsAgent.agentId !== RESERVED_MAIN_AGENT_ID}
            onToolCallingToggle={ctx.onToolCallingToggle}
            onThinkingTracesToggle={ctx.onThinkingTracesToggle}
            onNavigateToTasks={ctx.onNavigateToTasks}
          />
        </PanelErrorBoundary>
      )}
    </Suspense>
  );
});
