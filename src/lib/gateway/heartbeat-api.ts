/**
 * Heartbeat gateway API calls.
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isRecord } from "@/lib/type-guards";
import { resolveRequiredId } from "@/lib/validation";
import type { ConfigAgentEntry, GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";
import { writeConfigAgentList, upsertConfigAgentEntry } from "@/lib/gateway/agentConfigTypes";
import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";
import type {
  AgentHeartbeatResult,
  AgentHeartbeatUpdatePayload,
  HeartbeatListResult,
  HeartbeatWakeResult,
} from "./heartbeat-types";
import { resolveHeartbeatSettings, buildHeartbeatOverride } from "./heartbeat-format";

type GatewayStatusHeartbeatAgent = {
  agentId?: string;
  enabled?: boolean;
  every?: string;
  everyMs?: number | null;
};

type GatewayStatusSnapshot = {
  heartbeat?: {
    agents?: GatewayStatusHeartbeatAgent[];
  };
};

const resolveHeartbeatAgentId = (agentId: string) =>
  resolveRequiredId(agentId, "Agent id");

const resolveStatusHeartbeatAgent = (
  status: GatewayStatusSnapshot,
  agentId: string
): GatewayStatusHeartbeatAgent | null => {
  const list = Array.isArray(status.heartbeat?.agents) ? status.heartbeat?.agents : [];
  for (const entry of list) {
    if (!entry || typeof entry.agentId !== "string") continue;
    if (entry.agentId.trim() !== agentId) continue;
    return entry;
  }
  return null;
};

export const listHeartbeatsForAgent = async (
  client: GatewayClient,
  agentId: string
): Promise<HeartbeatListResult> => {
  const resolvedAgentId = resolveHeartbeatAgentId(agentId);
  const [snapshot, status] = await Promise.all([
    client.call<GatewayConfigSnapshot>("config.get", {}),
    client.call<GatewayStatusSnapshot>("status", {}),
  ]);
  const config = isRecord(snapshot.config) ? snapshot.config : {};
  const resolved = resolveHeartbeatSettings(config, resolvedAgentId);
  const statusHeartbeat = resolveStatusHeartbeatAgent(status, resolvedAgentId);
  const enabled = Boolean(statusHeartbeat?.enabled);
  const every = typeof statusHeartbeat?.every === "string" ? statusHeartbeat.every.trim() : "";
  const heartbeat = every ? { ...resolved.heartbeat, every } : resolved.heartbeat;
  if (!enabled && !resolved.hasOverride) {
    return { heartbeats: [] };
  }
  return {
    heartbeats: [
      {
        id: resolvedAgentId,
        agentId: resolvedAgentId,
        source: resolved.hasOverride ? "override" : "default",
        enabled,
        heartbeat,
      },
    ],
  };
};

export const triggerHeartbeatNow = async (
  client: GatewayClient,
  agentId: string
): Promise<HeartbeatWakeResult> => {
  const resolvedAgentId = resolveHeartbeatAgentId(agentId);
  return client.call<HeartbeatWakeResult>("wake", {
    mode: "now",
    text: `OpenClaw Studio heartbeat trigger (${resolvedAgentId}).`,
  });
};

export const updateGatewayHeartbeat = async (params: {
  client: GatewayClient;
  agentId: string;
  payload: AgentHeartbeatUpdatePayload;
  sessionKey?: string;
}): Promise<AgentHeartbeatResult> => {
  return withGatewayConfigMutation({
    client: params.client,
    sessionKey: params.sessionKey,
    mutate: ({ baseConfig, list }) => {
      const { list: nextList } = upsertConfigAgentEntry(
        list,
        params.agentId,
        (entry: ConfigAgentEntry) => {
          const next = { ...entry };
          if (params.payload.override) {
            next.heartbeat = buildHeartbeatOverride(params.payload.heartbeat);
          } else if ("heartbeat" in next) {
            delete next.heartbeat;
          }
          return next;
        }
      );
      const nextConfig = writeConfigAgentList(baseConfig, nextList);
      return {
        shouldPatch: true,
        patch: { agents: { list: nextList } },
        result: resolveHeartbeatSettings(nextConfig, params.agentId),
      };
    },
  });
};

export const removeGatewayHeartbeatOverride = async (params: {
  client: GatewayClient;
  agentId: string;
  sessionKey?: string;
}): Promise<AgentHeartbeatResult> => {
  return withGatewayConfigMutation({
    client: params.client,
    sessionKey: params.sessionKey,
    mutate: ({ baseConfig, list }) => {
      const nextList = list.map((entry) => {
        if (entry.id !== params.agentId) return entry;
        if (!("heartbeat" in entry)) return entry;
        const next = { ...entry };
        delete next.heartbeat;
        return next;
      });
      const changed = nextList.some((entry, index) => entry !== list[index]);
      if (!changed) {
        return {
          shouldPatch: false,
          result: resolveHeartbeatSettings(baseConfig, params.agentId),
        };
      }
      return {
        shouldPatch: true,
        patch: { agents: { list: nextList } },
        result: resolveHeartbeatSettings(writeConfigAgentList(baseConfig, nextList), params.agentId),
      };
    },
  });
};
