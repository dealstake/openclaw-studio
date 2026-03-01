"use client";

import { memo } from "react";

import type { AgentState } from "@/features/agents/state/store";
import { AgentInspectHeader } from "./AgentInspectHeader";
import { IdentitySettingsSection } from "./IdentitySettingsSection";
import { SessionSettingsSection } from "./SessionSettingsSection";
import { DangerZoneSection } from "./DangerZoneSection";
import { TooltipProvider } from "@/components/ui/tooltip";

type AgentSettingsPanelProps = {
  agent: AgentState;
  onClose: () => void;
  onRename: (value: string) => Promise<boolean>;
  onNewSession: () => Promise<void> | void;
  onDelete: () => void;
  canDelete?: boolean;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
};

export const AgentSettingsPanel = memo(function AgentSettingsPanel({
  agent,
  onClose,
  onRename,
  onNewSession,
  onDelete,
  canDelete = true,
  onToolCallingToggle,
  onThinkingTracesToggle,
}: AgentSettingsPanelProps) {
  return (
    <TooltipProvider>
      <div
        className="agent-inspect-panel"
        data-testid="agent-settings-panel"
        style={{ position: "relative", left: "auto", top: "auto", width: "100%", height: "100%" }}
      >
        <AgentInspectHeader
          label="Agent settings"
          title={agent.name}
          onClose={onClose}
          closeTestId="agent-settings-close"
        />

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
