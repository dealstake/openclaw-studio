import { useCallback, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";

export const useGatewayStatus = (client: GatewayClient, status: GatewayStatus) => {
  const [gatewayVersion, setGatewayVersion] = useState<string | undefined>();
  const [gatewayUptime, setGatewayUptime] = useState<number | undefined>();
  const [presenceAgentIds, setPresenceAgentIds] = useState<Set<string>>(new Set());

  const loadGatewayStatus = useCallback(async () => {
    if (status !== "connected") return;
    try {
      const hello = client.getLastHello();
      if (hello && typeof hello === "object") {
        const h = hello as Record<string, unknown>;
        if (typeof h.version === "string") setGatewayVersion(h.version);
        if (typeof h.startedAtMs === "number") setGatewayUptime(h.startedAtMs);
      }
    } catch {
      // ignore
    }
  }, [client, status]);

  const parsePresenceFromStatus = useCallback(async () => {
    if (status !== "connected") return;
    try {
      const result = await client.call<{
        presence?: Array<{ agentId?: string; active?: boolean }>;
      }>("status", {});
      const active = new Set<string>();
      for (const entry of result.presence ?? []) {
        if (entry.active && typeof entry.agentId === "string") {
          active.add(entry.agentId);
        }
      }
      setPresenceAgentIds(active);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        console.error("Failed to parse presence.", err);
      }
    }
  }, [client, status]);

  const resetPresence = useCallback(() => {
    setPresenceAgentIds(new Set());
  }, []);

  return {
    gatewayVersion,
    gatewayUptime,
    presenceAgentIds,
    loadGatewayStatus,
    parsePresenceFromStatus,
    resetPresence,
  };
};
