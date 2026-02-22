"use client";

import { lazy, memo, Suspense } from "react";
import type { ManagementTab } from "@/layout/AppSidebar";
import { ChannelsPanel } from "@/features/channels/components/ChannelsPanel";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";
import type { CronJobSummary } from "@/lib/cron/types";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { UsageByType } from "@/features/sessions/hooks/useAllSessions";

const SessionsPanel = lazy(() =>
  import("@/features/sessions/components/SessionsPanel").then((m) => ({
    default: m.SessionsPanel,
  }))
);
const CronPanel = lazy(() =>
  import("@/features/cron/components/CronPanel").then((m) => ({
    default: m.CronPanel,
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

type SessionEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null; provider?: string | null } | null;
  thinkingLevel?: string;
  modelProvider?: string;
  model?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  contextTokens?: number | null;
};

export type ManagementPanelContentProps = {
  tab: ManagementTab | null;
  client: GatewayClient;
  status: GatewayStatus;
  // Sessions
  focusedAgentId: string | null;
  allSessions: SessionEntry[];
  allSessionsLoading: boolean;
  allSessionsError: string | null;
  onRefreshSessions: () => void;
  activeSessionKey: string | null;
  aggregateUsage: { inputTokens: number; outputTokens: number; totalCost: number | null; messageCount: number } | null;
  aggregateUsageLoading: boolean;
  cumulativeUsage: { inputTokens: number; outputTokens: number; totalCost: number | null; messageCount: number } | null;
  cumulativeUsageLoading: boolean;
  usageByType: UsageByType | null;
  onViewTrace: (sessionKey: string, agentId: string | null) => void;
  onTranscriptClick: (sessionId: string, agentId: string | null) => void;
  // Channels
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsLoading: boolean;
  channelsError: string | null;
  onRefreshChannels: () => void;
  // Cron
  allCronJobs: CronJobSummary[];
  allCronLoading: boolean;
  allCronError: string | null;
  allCronRunBusyJobId: string | null;
  allCronDeleteBusyJobId: string | null;
  allCronToggleBusyJobId: string | null;
  onRunJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onToggleEnabled: (jobId: string) => void;
  onRefreshCron: () => void;
  // Settings
  settingsAgent: AgentState | null;
  onCloseSettings: () => void;
  onRenameAgent: (name: string) => Promise<boolean>;
  onNewSession: () => void;
  onDeleteAgent: () => void;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
  onNavigateToTasks: () => void;
};

export const ManagementPanelContent = memo(function ManagementPanelContent({
  tab,
  client,
  status,
  focusedAgentId,
  allSessions,
  allSessionsLoading,
  allSessionsError,
  onRefreshSessions,
  activeSessionKey,
  aggregateUsage,
  aggregateUsageLoading,
  cumulativeUsage,
  cumulativeUsageLoading,
  usageByType,
  onViewTrace,
  onTranscriptClick,
  channelsSnapshot,
  channelsLoading,
  channelsError,
  onRefreshChannels,
  allCronJobs,
  allCronLoading,
  allCronError,
  allCronRunBusyJobId,
  allCronDeleteBusyJobId,
  allCronToggleBusyJobId,
  onRunJob,
  onDeleteJob,
  onToggleEnabled,
  onRefreshCron,
  settingsAgent,
  onCloseSettings,
  onRenameAgent,
  onNewSession,
  onDeleteAgent,
  onToolCallingToggle,
  onThinkingTracesToggle,
  onNavigateToTasks,
}: ManagementPanelContentProps) {
  if (!tab) return null;

  return (
    <Suspense fallback={null}>
      {tab === "sessions" && (
        <SessionsPanel
          client={client}
          agentId={focusedAgentId}
          sessions={allSessions}
          loading={allSessionsLoading}
          error={allSessionsError}
          onRefresh={onRefreshSessions}
          activeSessionKey={activeSessionKey}
          aggregateUsage={aggregateUsage}
          aggregateUsageLoading={aggregateUsageLoading}
          cumulativeUsage={cumulativeUsage}
          cumulativeUsageLoading={cumulativeUsageLoading}
          usageByType={usageByType}
          onViewTrace={onViewTrace}
          onTranscriptClick={onTranscriptClick}
        />
      )}
      {tab === "usage" && <UsagePanel client={client} status={status} />}
      {tab === "channels" && (
        <ChannelsPanel
          snapshot={channelsSnapshot}
          loading={channelsLoading}
          error={channelsError}
          onRefresh={onRefreshChannels}
          hideHeader
        />
      )}
      {tab === "cron" && (
        <CronPanel
          client={client}
          cronJobs={allCronJobs}
          loading={allCronLoading}
          error={allCronError}
          runBusyJobId={allCronRunBusyJobId}
          deleteBusyJobId={allCronDeleteBusyJobId}
          toggleBusyJobId={allCronToggleBusyJobId}
          onRunJob={onRunJob}
          onDeleteJob={onDeleteJob}
          onToggleEnabled={onToggleEnabled}
          onRefresh={onRefreshCron}
        />
      )}
      {tab === "settings" && settingsAgent && (
        <AgentSettingsPanel
          key={settingsAgent.agentId}
          agent={settingsAgent}
          client={client}
          status={status}
          onClose={onCloseSettings}
          onRename={onRenameAgent}
          onNewSession={onNewSession}
          onDelete={onDeleteAgent}
          canDelete={settingsAgent.agentId !== RESERVED_MAIN_AGENT_ID}
          onToolCallingToggle={onToolCallingToggle}
          onThinkingTracesToggle={onThinkingTracesToggle}
          onNavigateToTasks={onNavigateToTasks}
        />
      )}
    </Suspense>
  );
});
