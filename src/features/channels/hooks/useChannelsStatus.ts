import { useCallback, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";
import { resolveChannelHealth } from "@/lib/gateway/channels";

export const useChannelsStatus = (client: GatewayClient, status: GatewayStatus) => {
  const [channelsSnapshot, setChannelsSnapshot] = useState<ChannelsStatusSnapshot | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [connectedChannelCount, setConnectedChannelCount] = useState(0);
  const [totalChannelCount, setTotalChannelCount] = useState(0);

  const loadChannelsStatus = useCallback(async () => {
    if (status !== "connected") return;
    setChannelsLoading(true);
    try {
      const result = await client.call<ChannelsStatusSnapshot>("channels.status", {});
      setChannelsSnapshot(result);
      setChannelsError(null);
      const channels = result?.channels ?? {};
      let connected = 0;
      for (const key of Object.keys(channels)) {
        const health = resolveChannelHealth(channels[key]);
        if (health === "connected" || health === "running") connected++;
      }
      setConnectedChannelCount(connected);
      const total = Object.keys(channels).filter((k) => {
        const entry = channels[k];
        return entry?.configured || entry?.running || entry?.connected;
      }).length;
      setTotalChannelCount(total);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message = err instanceof Error ? err.message : "Failed to load channels status.";
        setChannelsError(message);
      }
    } finally {
      setChannelsLoading(false);
    }
  }, [client, status]);

  const resetChannelsStatus = useCallback(() => {
    setChannelsSnapshot(null);
    setChannelsLoading(false);
  }, []);

  return {
    channelsSnapshot,
    channelsLoading,
    channelsError,
    connectedChannelCount,
    totalChannelCount,
    loadChannelsStatus,
    resetChannelsStatus,
  };
};
