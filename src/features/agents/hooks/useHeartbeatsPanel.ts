import { useCallback, useRef, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import {
  removeGatewayHeartbeatOverride,
  listHeartbeatsForAgent,
  triggerHeartbeatNow,
  type AgentHeartbeatSummary,
} from "@/lib/gateway/agentConfig";

type UseHeartbeatsPanelParams = {
  client: GatewayClient;
};

export function useHeartbeatsPanel({ client }: UseHeartbeatsPanelParams) {
  const [heartbeats, setHeartbeats] = useState<AgentHeartbeatSummary[]>([]);
  const [heartbeatLoading, setHeartbeatLoading] = useState(false);
  const [heartbeatError, setHeartbeatError] = useState<string | null>(null);
  const [heartbeatRunBusyId, setHeartbeatRunBusyId] = useState<string | null>(null);
  const [heartbeatDeleteBusyId, setHeartbeatDeleteBusyId] = useState<string | null>(null);

  const loadHeartbeats = useCallback(
    async (agentId: string) => {
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId) {
        setHeartbeats([]);
        setHeartbeatError("Failed to load heartbeats: missing agent id.");
        return;
      }
      setHeartbeatLoading(true);
      setHeartbeatError(null);
      try {
        const result = await listHeartbeatsForAgent(client, resolvedAgentId);
        setHeartbeats(result.heartbeats);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load heartbeats.";
        setHeartbeats([]);
        setHeartbeatError(message);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
      } finally {
        setHeartbeatLoading(false);
      }
    },
    [client],
  );

  const loadHeartbeatsRef = useRef(loadHeartbeats);
  loadHeartbeatsRef.current = loadHeartbeats;

  const handleRunHeartbeat = useCallback(
    async (agentId: string, heartbeatId: string) => {
      const resolvedAgentId = agentId.trim();
      const resolvedHeartbeatId = heartbeatId.trim();
      if (!resolvedAgentId || !resolvedHeartbeatId) return;
      if (heartbeatRunBusyId || heartbeatDeleteBusyId) return;
      setHeartbeatRunBusyId(resolvedHeartbeatId);
      setHeartbeatError(null);
      try {
        await triggerHeartbeatNow(client, resolvedAgentId);
        await loadHeartbeats(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to trigger heartbeat.";
        setHeartbeatError(message);
        console.error(message);
      } finally {
        setHeartbeatRunBusyId((current) =>
          current === resolvedHeartbeatId ? null : current,
        );
      }
    },
    [client, heartbeatDeleteBusyId, heartbeatRunBusyId, loadHeartbeats],
  );

  const handleDeleteHeartbeat = useCallback(
    async (agentId: string, heartbeatId: string) => {
      const resolvedAgentId = agentId.trim();
      const resolvedHeartbeatId = heartbeatId.trim();
      if (!resolvedAgentId || !resolvedHeartbeatId) return;
      if (heartbeatRunBusyId || heartbeatDeleteBusyId) return;
      setHeartbeatDeleteBusyId(resolvedHeartbeatId);
      setHeartbeatError(null);
      try {
        await removeGatewayHeartbeatOverride({
          client,
          agentId: resolvedAgentId,
        });
        setHeartbeats((hbs) =>
          hbs.filter((hb) => hb.id !== resolvedHeartbeatId),
        );
        await loadHeartbeats(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete heartbeat.";
        setHeartbeatError(message);
        console.error(message);
      } finally {
        setHeartbeatDeleteBusyId((current) =>
          current === resolvedHeartbeatId ? null : current,
        );
      }
    },
    [client, heartbeatDeleteBusyId, heartbeatRunBusyId, loadHeartbeats],
  );

  const resetHeartbeats = useCallback(() => {
    setHeartbeats([]);
    setHeartbeatLoading(false);
    setHeartbeatError(null);
    setHeartbeatRunBusyId(null);
    setHeartbeatDeleteBusyId(null);
  }, []);

  return {
    heartbeats,
    heartbeatLoading,
    heartbeatError,
    heartbeatRunBusyId,
    heartbeatDeleteBusyId,
    loadHeartbeats,
    loadHeartbeatsRef,
    handleRunHeartbeat,
    handleDeleteHeartbeat,
    resetHeartbeats,
  };
}
