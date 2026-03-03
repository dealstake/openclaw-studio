"use client";

import React, { memo } from "react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetClose,
  SideSheetBody,
  SideSheetTitle,
} from "@/components/ui/SideSheet";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { PersonaDetailContent } from "./PersonaDetailContent";

// ---------------------------------------------------------------------------
// Main Component — SideSheet wrapper for non-panel viewports
// ---------------------------------------------------------------------------

export interface PersonaDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The agent/persona to display details for */
  agent: AgentState | null;
  /** All agents (passed to BrainPanel) */
  agents: AgentState[];
  /** Gateway client for API calls */
  client: GatewayClient;
  /** Gateway connection status */
  status: GatewayStatus;
  /** Available models */
  models?: GatewayModelChoice[];
}

export const PersonaDetailModal = memo(function PersonaDetailModal({
  open,
  onOpenChange,
  agent,
  agents,
  client,
  status,
  models,
}: PersonaDetailModalProps) {
  if (!agent) return null;

  return (
    <SideSheet open={open} onOpenChange={onOpenChange}>
      <SideSheetContent className="max-w-lg">
        <SideSheetHeader>
          <SideSheetTitle className="text-sm font-semibold">
            {agent.name ?? agent.agentId}
          </SideSheetTitle>
          <SideSheetClose />
        </SideSheetHeader>

        <SideSheetBody>
          <PersonaDetailContent
            agent={agent}
            agents={agents}
            client={client}
            status={status}
            models={models}
          />
        </SideSheetBody>
      </SideSheetContent>
    </SideSheet>
  );
});
