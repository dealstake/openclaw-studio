"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";
import type { AgentState } from "@/features/agents/state/store";

export interface ManagementPanelContextValue {
  client: GatewayClient;
  status: GatewayStatus;
  // Sessions
  focusedAgentId: string | null;
  activeSessionKey: string | null;
  onViewTrace: (sessionKey: string, agentId: string | null) => void;
  onTranscriptClick: (sessionId: string, agentId: string | null) => void;
  // Channels
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsLoading: boolean;
  channelsError: string | null;
  onRefreshChannels: () => void;
  // Settings
  settingsAgent: AgentState | null;
  onCloseSettings: () => void;
  onRenameAgent: (name: string) => Promise<boolean>;
  onNewSession: () => void;
  onDeleteAgent: () => void;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
  onNavigateToTasks: () => void;
}

const ManagementPanelContext = createContext<ManagementPanelContextValue | null>(null);

export function useManagementPanel(): ManagementPanelContextValue {
  const ctx = useContext(ManagementPanelContext);
  if (!ctx) throw new Error("useManagementPanel must be used within ManagementPanelProvider");
  return ctx;
}

export interface ManagementPanelProviderProps extends ManagementPanelContextValue {
  children: ReactNode;
}

export function ManagementPanelProvider({ children, ...value }: ManagementPanelProviderProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- individual value keys listed below
  const memoized = useMemo(() => value, [
    value.client, value.status, value.focusedAgentId,
    value.activeSessionKey,
    value.onViewTrace, value.onTranscriptClick,
    value.channelsSnapshot, value.channelsLoading, value.channelsError, value.onRefreshChannels,
    value.settingsAgent, value.onCloseSettings, value.onRenameAgent,
    value.onNewSession, value.onDeleteAgent, value.onToolCallingToggle,
    value.onThinkingTracesToggle, value.onNavigateToTasks,
  ]);

  return (
    <ManagementPanelContext.Provider value={memoized}>
      {children}
    </ManagementPanelContext.Provider>
  );
}
