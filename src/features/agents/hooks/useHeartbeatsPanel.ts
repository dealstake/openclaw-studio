import { useMemo } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  removeGatewayHeartbeatOverride,
  listHeartbeatsForAgent,
  triggerHeartbeatNow,
  type AgentHeartbeatSummary,
} from "@/lib/gateway/agentConfig";
import { type UseResourcePanelConfig, useResourcePanel } from "./useResourcePanel";

type UseHeartbeatsPanelParams = {
  client: GatewayClient;
};

export function useHeartbeatsPanel({ client }: UseHeartbeatsPanelParams) {
  const config = useMemo(
    (): UseResourcePanelConfig<AgentHeartbeatSummary> => ({
      resourceLabel: "heartbeats",
      fetchItems: async (agentId) => {
        const result = await listHeartbeatsForAgent(client, agentId);
        return result.heartbeats;
      },
      runItem: async (agentId, _heartbeatId) => {
        await triggerHeartbeatNow(client, agentId);
      },
      deleteItem: async (agentId, _heartbeatId) => {
        await removeGatewayHeartbeatOverride({ client, agentId });
        return true;
      },
    }),
    [client],
  );

  const panel = useResourcePanel(config);

  // Re-export with original names for backward compatibility
  return {
    heartbeats: panel.items,
    heartbeatLoading: panel.loading,
    heartbeatError: panel.error,
    heartbeatRunBusyId: panel.runBusyId,
    heartbeatDeleteBusyId: panel.deleteBusyId,
    loadHeartbeats: panel.load,
    loadHeartbeatsRef: panel.loadRef,
    handleRunHeartbeat: panel.handleRun,
    handleDeleteHeartbeat: panel.handleDelete,
    resetHeartbeats: panel.reset,
  };
}
