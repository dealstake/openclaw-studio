"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";
import { resolveChannelHealth } from "@/lib/gateway/channels";
import type { ChannelConfig, ChannelConnectionStatus, ChannelEntry } from "../lib/types";
import { findChannelTemplate } from "../lib/channelTemplates";
import * as channelService from "../lib/channelService";

/** Map gateway health to our ChannelConnectionStatus vocabulary. */
function toConnectionStatus(
  health: ReturnType<typeof resolveChannelHealth>,
): ChannelConnectionStatus {
  switch (health) {
    case "connected":
    case "running":
      return "connected";
    case "configured":
      return "connecting";
    case "error":
      return "error";
    case "off":
    default:
      return "disconnected";
  }
}

export function useChannels(client: GatewayClient, status: GatewayStatus) {
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      // Fetch both config and live status in parallel
      const [configs, statusSnapshot] = await Promise.all([
        channelService.listChannelConfigs(client),
        client.call<ChannelsStatusSnapshot>("channels.status", {}),
      ]);

      const statusChannels = statusSnapshot?.channels ?? {};

      // Merge: start with configured channels, overlay live status
      const seen = new Set<string>();
      const entries: ChannelEntry[] = [];

      // All channels from config
      for (const [id, config] of Object.entries(configs)) {
        seen.add(id);
        const liveEntry = statusChannels[id];
        const health = resolveChannelHealth(liveEntry);
        entries.push({
          channelId: id,
          config,
          connectionStatus: toConnectionStatus(health),
          lastError: liveEntry?.lastError ?? undefined,
          template: findChannelTemplate(id),
        });
      }

      // Channels that appear in live status but not in config (shouldn't happen, but be safe)
      for (const [id, entry] of Object.entries(statusChannels)) {
        if (seen.has(id)) continue;
        if (!entry?.configured && !entry?.running && !entry?.connected) continue;
        const health = resolveChannelHealth(entry);
        entries.push({
          channelId: id,
          config: {},
          connectionStatus: toConnectionStatus(health),
          lastError: entry?.lastError ?? undefined,
          template: findChannelTemplate(id),
        });
      }

      setChannels(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  // Stable ref pattern (same as useCredentials)
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    void loadRef.current();
  }, [status]);

  const create = useCallback(
    async (channelId: string, config: ChannelConfig) => {
      try {
        await channelService.createChannel(client, channelId, config);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create channel");
        throw err;
      }
    },
    [client, load],
  );

  const update = useCallback(
    async (channelId: string, updates: Partial<ChannelConfig>) => {
      try {
        await channelService.updateChannel(client, channelId, updates);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update channel");
        throw err;
      }
    },
    [client, load],
  );

  const remove = useCallback(
    async (channelId: string) => {
      try {
        await channelService.deleteChannel(client, channelId);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete channel");
        throw err;
      }
    },
    [client, load],
  );

  const disconnect = useCallback(
    async (channelId: string) => {
      try {
        await channelService.disconnectChannel(client, channelId);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to disconnect channel");
        throw err;
      }
    },
    [client, load],
  );

  const reconnect = useCallback(
    async (channelId: string) => {
      try {
        await channelService.reconnectChannel(client, channelId);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reconnect channel");
        throw err;
      }
    },
    [client, load],
  );

  const readConfig = useCallback(
    async (channelId: string) => {
      return channelService.readChannelConfig(client, channelId);
    },
    [client],
  );

  return {
    channels,
    loading,
    error,
    refresh: load,
    create,
    update,
    remove,
    disconnect,
    reconnect,
    readConfig,
  };
}
