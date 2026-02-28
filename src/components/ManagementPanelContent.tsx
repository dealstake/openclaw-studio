"use client";

import { lazy, memo, Suspense } from "react";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import type { ManagementTab } from "@/layout/AppSidebar";
import { ChannelsPanel } from "@/features/channels/components/ChannelsPanel";
import { useManagementPanel } from "@/components/management/ManagementPanelContext";

const UsagePanel = lazy(() =>
  import("@/features/usage/components/UsagePanel").then((m) => ({
    default: m.UsagePanel,
  }))
);
const CredentialsPanel = lazy(() =>
  import("@/features/credentials/components/CredentialsPanel").then((m) => ({
    default: m.CredentialsPanel,
  }))
);
const ModelsPanel = lazy(() =>
  import("@/features/models/components/ModelsPanel").then((m) => ({
    default: m.ModelsPanel,
  }))
);
import {
  AgentSettingsPanel,
} from "@/features/agents/components/AgentInspectPanels";
import { LogoutButton } from "@/components/brand/LogoutButton";

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
      {tab === "credentials" && (
        <PanelErrorBoundary name="Credentials">
          <CredentialsPanel client={ctx.client} status={ctx.status} />
        </PanelErrorBoundary>
      )}
      {tab === "models" && (
        <PanelErrorBoundary name="Models">
          <ModelsPanel client={ctx.client} status={ctx.status} agentId={ctx.focusedAgentId} />
        </PanelErrorBoundary>
      )}
      {tab === "settings" && ctx.settingsAgent && (
        <PanelErrorBoundary name="Settings">
          <AgentSettingsPanel
            key={ctx.settingsAgent.agentId}
            agent={ctx.settingsAgent}
            onClose={onCloseSettings}
            onRename={ctx.onRenameAgent}
            onNewSession={ctx.onNewSession}
            onDelete={ctx.onDeleteAgent}
            canDelete={ctx.settingsAgent.agentId !== RESERVED_MAIN_AGENT_ID}
            onToolCallingToggle={ctx.onToolCallingToggle}
            onThinkingTracesToggle={ctx.onThinkingTracesToggle}
          />
          <div className="mt-4 border-t border-border/40 px-4 pt-4">
            <LogoutButton />
          </div>
        </PanelErrorBoundary>
      )}
    </Suspense>
  );
});
