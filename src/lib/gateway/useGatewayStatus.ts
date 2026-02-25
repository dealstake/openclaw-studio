import { useCallback, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";

/**
 * Hook managing gateway version, uptime, and agent presence state.
 * Relocated from src/features/status/ — this is gateway infrastructure, not a feature.
 */
export const useGatewayStatus = (client: GatewayClient, status: GatewayStatus) => {
  const [gatewayVersion, setGatewayVersion] = useState<string | undefined>();
  const [gatewayUptime, setGatewayUptime] = useState<number | undefined>();
  const [presenceAgentIds, setPresenceAgentIds] = useState<string[]>([]);
  const prevPresenceRef = useRef<string>("");

  const loadGatewayStatus = useCallback(() => {
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
      const activeIds: string[] = [];
      for (const entry of result.presence ?? []) {
        if (entry.active && typeof entry.agentId === "string") {
          activeIds.push(entry.agentId);
        }
      }
      activeIds.sort();
      const key = activeIds.join(",");
      if (key !== prevPresenceRef.current) {
        prevPresenceRef.current = key;
        setPresenceAgentIds(activeIds);
      }
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        console.error("Failed to parse presence.", err);
      }
    }
  }, [client, status]);

  const resetPresence = useCallback(() => {
    prevPresenceRef.current = "";
    setPresenceAgentIds([]);
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
