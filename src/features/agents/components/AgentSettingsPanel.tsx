"use client";

import { memo } from "react";

import type { AgentState } from "@/features/agents/state/store";
import { AgentInspectHeader } from "./AgentInspectHeader";
import { IdentitySettingsSection } from "./IdentitySettingsSection";
import { SessionSettingsSection } from "./SessionSettingsSection";
import { DangerZoneSection } from "./DangerZoneSection";
import { AutonomyLevelSelector } from "./AutonomyLevelSelector";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AutonomyLevel } from "@/features/agents/lib/autonomyService";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { GuardrailsSection } from "@/features/guardrails/components/GuardrailsSection";

type AgentSettingsPanelProps = {
  agent: AgentState;
  onClose: () => void;
  /** Hide the header bar (used when embedded in another panel) */
  hideHeader?: boolean;
  onRename: (value: string) => Promise<boolean>;
  onNewSession: () => Promise<void> | void;
  onDelete: () => void;
  canDelete?: boolean;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
  onAutonomyChange: (level: AutonomyLevel) => void;
  /** GatewayClient — required to render the GuardrailsSection. */
  client?: GatewayClient | null;
  /** Gateway connection status — required to render the GuardrailsSection. */
  status?: GatewayStatus;
};

export const AgentSettingsPanel = memo(function AgentSettingsPanel({
  agent,
  onClose,
  hideHeader,
  onRename,
  onNewSession,
  onDelete,
  canDelete = true,
  onToolCallingToggle,
  onThinkingTracesToggle,
  onAutonomyChange,
  client,
  status,
}: AgentSettingsPanelProps) {
  return (
    <TooltipProvider>
      <div
        className="agent-inspect-panel"
        data-testid="agent-settings-panel"
        style={{ position: "relative", left: "auto", top: "auto", width: "100%", height: "100%" }}
      >
        {!hideHeader && (
          <AgentInspectHeader
            label="Agent settings"
            title={agent.name}
            onClose={onClose}
            closeTestId="agent-settings-close"
          />
        )}

        <div className="flex flex-col gap-4 p-4">
          <IdentitySettingsSection
            agentId={agent.agentId}
            agentName={agent.name}
            onRename={onRename}
          />

          <SessionSettingsSection
            toolCallingEnabled={agent.toolCallingEnabled}
            showThinkingTraces={agent.showThinkingTraces}
            onToolCallingToggle={onToolCallingToggle}
            onThinkingTracesToggle={onThinkingTracesToggle}
            onNewSession={onNewSession}
          />

          <AutonomyLevelSelector
            value={agent.autonomyLevel}
            onChange={onAutonomyChange}
          />

          {client && status ? (
            <GuardrailsSection
              client={client}
              agentId={agent.agentId}
              status={status}
            />
          ) : null}

          <DangerZoneSection
            agentId={agent.agentId}
            canDelete={canDelete}
            onDelete={onDelete}
          />
        </div>
      </div>
    </TooltipProvider>
  );
});
