"use client";

import { memo, Suspense } from "react";
import dynamic from "next/dynamic";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import type { ManagementTab } from "@/layout/AppSidebar";
import { useManagementPanel } from "@/components/management/ManagementPanelContext";

const ChannelsPanel = dynamic(
  () => import("@/features/channels/components/ChannelsPanel").then((m) => ({ default: m.ChannelsPanel })),
  { ssr: false },
);
const UsagePanel = dynamic(
  () => import("@/features/usage/components/UsagePanel").then((m) => ({ default: m.UsagePanel })),
  { ssr: false },
);
const CredentialsPanel = dynamic(
  () => import("@/features/credentials/components/CredentialsPanel").then((m) => ({ default: m.CredentialsPanel })),
  { ssr: false },
);
const ModelsPanel = dynamic(
  () => import("@/features/models/components/ModelsPanel").then((m) => ({ default: m.ModelsPanel })),
  { ssr: false },
);
const GatewaySettingsPanel = dynamic(
  () => import("@/features/gateway-settings/components/GatewaySettingsPanel").then((m) => ({ default: m.GatewaySettingsPanel })),
  { ssr: false },
);
const ContactsPanel = dynamic(
  () => import("@/features/contacts/components/ContactsPanel").then((m) => ({ default: m.ContactsPanel })),
  { ssr: false },
);
const VoiceSettingsPanelConnected = dynamic(
  () => import("@/features/voice/components/VoiceSettingsPanelConnected").then((m) => ({ default: m.VoiceSettingsPanelConnected })),
  { ssr: false },
);
const PersonasPanel = dynamic(
  () => import("@/features/personas/components/PersonasPanel").then((m) => ({ default: m.PersonasPanel })),
  { ssr: false },
);


export interface ManagementPanelContentProps {
  tab: ManagementTab | null;
  /** Override context onTranscriptClick for specific usage sites */
  onTranscriptClick?: (sessionId: string, agentId: string | null) => void;
}

export const ManagementPanelContent = memo(function ManagementPanelContent({
  tab,
  onTranscriptClick: onTranscriptClickOverride,
}: ManagementPanelContentProps) {
  const ctx = useManagementPanel();

  const _onTranscriptClick = onTranscriptClickOverride ?? ctx.onTranscriptClick;

  if (!tab) return null;

  return (
    <Suspense fallback={null}>
      {tab === "usage" && (
        <PanelErrorBoundary name="Usage">
          <UsagePanel />
        </PanelErrorBoundary>
      )}
      {tab === "channels" && (
        <PanelErrorBoundary name="Channels">
          <ChannelsPanel client={ctx.client} status={ctx.status} />
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
      {tab === "gateway" && (
        <PanelErrorBoundary name="Gateway">
          <GatewaySettingsPanel client={ctx.client} status={ctx.status} />
        </PanelErrorBoundary>
      )}
      {tab === "contacts" && (
        <PanelErrorBoundary name="Contacts">
          <ContactsPanel />
        </PanelErrorBoundary>
      )}
      {tab === "voice" && (
        <PanelErrorBoundary name="Voice">
          <VoiceSettingsPanelConnected />
        </PanelErrorBoundary>
      )}
      {tab === "personas" && (
        <PanelErrorBoundary name="Personas">
          <PersonasPanel
            client={ctx.client}
            agentId={ctx.focusedAgentId}
            status={ctx.status}
            initialDetailAgentId={ctx.settingsAgent?.personaStatus ? ctx.settingsAgent.agentId : null}
          />
        </PanelErrorBoundary>
      )}
    </Suspense>
  );
});
