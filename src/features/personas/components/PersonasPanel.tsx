"use client";

import { memo } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useAgentState } from "@/features/agents/state/store";
import { PersonasTab } from "./PersonasTab";

export interface PersonasPanelProps {
  client: GatewayClient;
  agentId: string | null;
  status: GatewayStatus;
}

/**
 * Standalone personas panel for the management sidebar.
 * Wraps PersonasTab with the correct layout for the management panel context.
 */
export const PersonasPanel = memo(function PersonasPanel({
  client,
  agentId,
  status,
}: PersonasPanelProps) {
  const { state } = useAgentState();

  return (
    <div className="flex h-full flex-col">
      <PersonasTab
        client={client}
        agentId={agentId}
        status={status}
        agents={state.agents}
      />
    </div>
  );
});
