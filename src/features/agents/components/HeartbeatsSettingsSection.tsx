"use client";

import { memo, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentHeartbeatSummary } from "@/lib/gateway/agentConfig";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useHeartbeatsPanel } from "../hooks/useHeartbeatsPanel";
import { SettingsListSection } from "./SettingsListSection";
import { SettingsListItem } from "./SettingsListItem";

const formatHeartbeatSchedule = (heartbeat: AgentHeartbeatSummary) =>
  `Every ${heartbeat.heartbeat.every}`;

const formatHeartbeatTarget = (heartbeat: AgentHeartbeatSummary) =>
  `Target: ${heartbeat.heartbeat.target}`;

const formatHeartbeatSource = (heartbeat: AgentHeartbeatSummary) =>
  heartbeat.source === "override" ? "Override" : "Inherited";

type HeartbeatsSettingsSectionProps = {
  client: GatewayClient;
  agentId: string;
  status: GatewayStatus;
};

export const HeartbeatsSettingsSection = memo(function HeartbeatsSettingsSection({
  client,
  agentId,
  status,
}: HeartbeatsSettingsSectionProps) {
  const {
    heartbeats,
    heartbeatLoading,
    heartbeatError,
    heartbeatRunBusyId,
    heartbeatDeleteBusyId,
    loadHeartbeats,
    handleRunHeartbeat,
    handleDeleteHeartbeat,
    resetHeartbeats,
  } = useHeartbeatsPanel({ client });

  useEffect(() => {
    if (status !== "connected" || !agentId) {
      resetHeartbeats();
      return;
    }
    void loadHeartbeats(agentId);
  }, [agentId, status, loadHeartbeats, resetHeartbeats]);

  return (
    <SettingsListSection
      label="Heartbeats"
      testId="agent-settings-heartbeat"
      count={heartbeats.length}
      loading={heartbeatLoading}
      error={heartbeatError}
      onRetry={() => { void loadHeartbeats(agentId); }}
      emptyMessage="No heartbeats for this agent."
      isEmpty={heartbeats.length === 0}
    >
      {heartbeats.map((heartbeat) => (
        <SettingsListItem
          key={heartbeat.id}
          id={heartbeat.id}
          title={heartbeat.agentId}
          groupName="heartbeat"
          deleteAllowed={heartbeat.source === "override"}
          deleteDisabledTooltip={heartbeat.source !== "override" ? "Inherited from gateway config — cannot be deleted here" : undefined}
          metadata={
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {formatHeartbeatSchedule(heartbeat)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>How often the heartbeat fires</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {formatHeartbeatTarget(heartbeat)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>Which session receives the heartbeat</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {formatHeartbeatSource(heartbeat)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {heartbeat.source === "override"
                    ? "Configured as an agent-level override"
                    : "Inherited from global gateway config"}
                </TooltipContent>
              </Tooltip>
            </>
          }
          runBusy={heartbeatRunBusyId === heartbeat.id}
          deleteBusy={heartbeatDeleteBusyId === heartbeat.id}
          runLabel={`Run heartbeat for ${heartbeat.agentId} now`}
          deleteLabel={`Delete heartbeat for ${heartbeat.agentId}`}
          onRun={() => { void handleRunHeartbeat(agentId, heartbeat.id); }}
          onDelete={() => { void handleDeleteHeartbeat(agentId, heartbeat.id); }}
        />
      ))}
    </SettingsListSection>
  );
});
