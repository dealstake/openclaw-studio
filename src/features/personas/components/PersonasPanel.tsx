"use client";

import { memo } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useAgentState } from "@/features/agents/state/store";
import { PersonasTab } from "./PersonasTab";

export interface PersonasPanelProps {
  client: GatewayClient;
  agentId: string | null;
  status: GatewayStatus;
  /** If set, auto-open the detail modal for this agent */
  initialDetailAgentId?: string | null;
}

/**
 * Standalone personas panel for the management sidebar.
 * Wraps PersonasTab with the correct layout for the management panel context.
 */
export const PersonasPanel = memo(function PersonasPanel({
  client,
  agentId,
  status,
  initialDetailAgentId,
}: PersonasPanelProps) {
  const { state } = useAgentState();

  return (
    <div className="flex h-full flex-col">
      <PersonasTab
        client={client}
        agentId={agentId}
        status={status}
        agents={state.agents}
        initialDetailAgentId={initialDetailAgentId}
      />
    </div>
  );
});
