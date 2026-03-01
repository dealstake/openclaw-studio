/**
 * Channel Configuration — Service layer.
 *
 * All channel CRUD via config.get / config.patch.
 * Channel configs live at openclaw.json → channels.<channelId>.
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";
import { isRecord } from "@/lib/type-guards";
import type { ChannelConfig } from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function readChannelsBlock(
  config: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const channels = isRecord(config.channels) ? config.channels : {};
  const result: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(channels)) {
    if (isRecord(value)) {
      result[key] = value as Record<string, unknown>;
    }
  }
  return result;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Read all channel configs from gateway config. */
export async function listChannelConfigs(
  client: GatewayClient,
): Promise<Record<string, Record<string, unknown>>> {
  const snapshot = await client.call<GatewayConfigSnapshot>("config.get", {});
  const config = isRecord(snapshot.config) ? snapshot.config : {};
  return readChannelsBlock(config);
}

/** Read a single channel's full config for edit form pre-population. */
export async function readChannelConfig(
  client: GatewayClient,
  channelId: string,
): Promise<Record<string, unknown> | null> {
  const all = await listChannelConfigs(client);
  return all[channelId] ?? null;
}

/** Create a new channel config via config.patch. */
export async function createChannel(
  client: GatewayClient,
  channelId: string,
  config: ChannelConfig,
): Promise<void> {
  return withGatewayConfigMutation({
    client,
    mutate: () => {
      const patch = { channels: { [channelId]: config } };
      return { shouldPatch: true, patch, result: undefined };
    },
  });
}

/** Update an existing channel config (partial merge). */
export async function updateChannel(
  client: GatewayClient,
  channelId: string,
  updates: Partial<ChannelConfig>,
): Promise<void> {
  return withGatewayConfigMutation({
    client,
    mutate: () => {
      const patch = { channels: { [channelId]: updates } };
      return { shouldPatch: true, patch, result: undefined };
    },
  });
}

/** Delete a channel config (JSON merge patch: null deletes key). */
export async function deleteChannel(
  client: GatewayClient,
  channelId: string,
): Promise<void> {
  return withGatewayConfigMutation({
    client,
    mutate: () => {
      const patch = { channels: { [channelId]: null } };
      return { shouldPatch: true, patch, result: undefined };
    },
  });
}

/** Disconnect a connected channel via channels.logout RPC. */
export async function disconnectChannel(
  client: GatewayClient,
  channel: string,
): Promise<void> {
  await client.call("channels.logout", { channel });
}

/** Reconnect a channel by re-patching its existing config. */
export async function reconnectChannel(
  client: GatewayClient,
  channelId: string,
): Promise<void> {
  return withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const channels = readChannelsBlock(baseConfig);
      const existing = channels[channelId];
      if (!existing) return { shouldPatch: false, result: undefined };
      // Re-patch the same config to trigger gateway reconnect
      const patch = { channels: { [channelId]: existing } };
      return { shouldPatch: true, patch, result: undefined };
    },
  });
}

/** Start WhatsApp QR pairing. */
export async function startWhatsAppLogin(
  client: GatewayClient,
  force?: boolean,
): Promise<{ message?: string; qrDataUrl?: string }> {
  return client.call("web.login.start", { force, timeoutMs: 30000 });
}

/** Wait for WhatsApp QR scan completion (long-poll). */
export async function waitWhatsAppLogin(
  client: GatewayClient,
): Promise<{ message?: string; connected?: boolean }> {
  return client.call("web.login.wait", { timeoutMs: 120000 });
}
