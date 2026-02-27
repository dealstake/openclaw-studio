import { useCallback, useMemo, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";
import { resolveChannelHealth } from "@/lib/gateway/channels";

export const useChannelsStatus = (client: GatewayClient, status: GatewayStatus) => {
  const [channelsSnapshot, setChannelsSnapshot] = useState<ChannelsStatusSnapshot | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  const connectedChannelCount = useMemo(() => {
    const channels = channelsSnapshot?.channels ?? {};
    let connected = 0;
    for (const key of Object.keys(channels)) {
      const health = resolveChannelHealth(channels[key]);
      if (health === "connected" || health === "running") connected++;
    }
    return connected;
  }, [channelsSnapshot]);

  const totalChannelCount = useMemo(() => {
    const channels = channelsSnapshot?.channels ?? {};
    return Object.keys(channels).filter((k) => {
      const entry = channels[k];
      return entry?.configured || entry?.running || entry?.connected;
    }).length;
  }, [channelsSnapshot]);

  const abortRef = useRef<AbortController | null>(null);

  const loadChannelsStatus = useCallback(async () => {
    if (status !== "connected") return;

    // Abort any in-flight request to prevent race conditions on rapid re-calls
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setChannelsLoading(true);
    try {
      const result = await client.call<ChannelsStatusSnapshot>("channels.status", {});
      if (controller.signal.aborted) return;
      setChannelsSnapshot(result);
      setChannelsError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!isGatewayDisconnectLikeError(err)) {
        const message = err instanceof Error ? err.message : "Failed to load channels status.";
        setChannelsError(message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setChannelsLoading(false);
      }
    }
  }, [client, status]);

  const resetChannelsStatus = useCallback(() => {
    abortRef.current?.abort();
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
