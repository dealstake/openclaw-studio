/**
 * Gateway Settings — Service layer.
 *
 * Parses config.get snapshots into typed settings and provides
 * mutation helpers via withGatewayConfigMutation.
 *
 * Audit fixes applied (2026-03-01):
 * - updateModelFallbacks: preserve string value as primary when upgrading to object
 * - removeCatalogEntry: send null explicitly for deep-merge deletion
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";
import { isRecord } from "@/lib/type-guards";
import type {
  ParsedGatewaySettings,
  ModelDefaultsConfig,
  SessionResetConfig,
  CompactionConfig,
  SecurityDisplayConfig,
} from "./types";

/* ── Parse config.get result into typed settings ── */

export function parseGatewaySettings(
  snapshot: GatewayConfigSnapshot,
): ParsedGatewaySettings {
  const config = isRecord(snapshot.config) ? snapshot.config : {};
  const agents = isRecord(config.agents) ? config.agents : {};
  const defaults = isRecord(agents.defaults) ? agents.defaults : {};
  const gateway = isRecord(config.gateway) ? config.gateway : {};
  const sessionRaw = isRecord(config.session) ? config.session : {};
  const auth = isRecord(gateway.auth) ? gateway.auth : {};
  const controlUi = isRecord(gateway.controlUi) ? gateway.controlUi : {};
  const compactionRaw = isRecord(defaults.compaction) ? defaults.compaction : {};

  // Model defaults
  const modelRaw = defaults.model;
  const modelDefaults: ModelDefaultsConfig = {
    primary:
      typeof modelRaw === "string"
        ? modelRaw
        : isRecord(modelRaw)
          ? typeof modelRaw.primary === "string"
            ? modelRaw.primary
            : null
          : null,
    fallbacks:
      isRecord(modelRaw) && Array.isArray(modelRaw.fallbacks)
        ? modelRaw.fallbacks.filter((f): f is string => typeof f === "string")
        : [],
    catalog: isRecord(defaults.models)
      ? (defaults.models as Record<string, { alias?: string }>)
      : {},
  };

  // Session reset
  const resetRaw = isRecord(sessionRaw.reset) ? sessionRaw.reset : {};
  const sessionConfig: SessionResetConfig = {
    mode: (resetRaw.mode as "daily" | "idle" | "") || "",
    atHour:
      typeof resetRaw.atHour === "number" ? resetRaw.atHour : undefined,
    idleMinutes:
      typeof resetRaw.idleMinutes === "number"
        ? resetRaw.idleMinutes
        : undefined,
  };

  // Compaction
  const compactionConfig: CompactionConfig = {
    mode: (compactionRaw.mode as "default" | "safeguard" | "") || "",
    reserveTokensFloor:
      typeof compactionRaw.reserveTokensFloor === "number"
        ? compactionRaw.reserveTokensFloor
        : undefined,
    memoryFlush: isRecord(compactionRaw.memoryFlush)
      ? { enabled: compactionRaw.memoryFlush.enabled as boolean | undefined }
      : undefined,
  };

  // Security (read-only display)
  // Store raw token — SecureInput handles its own masking (P2 audit fix: do not pre-mask)
  const tokenValue =
    typeof auth.token === "string" ? auth.token : null;
  const security: SecurityDisplayConfig = {
    authMode: typeof auth.mode === "string" ? auth.mode : "token",
    hasToken: !!tokenValue,
    tokenRaw: tokenValue,
    dangerouslyDisableDeviceAuth: controlUi.dangerouslyDisableDeviceAuth === true,
    trustedProxies: Array.isArray(gateway.trustedProxies)
      ? gateway.trustedProxies.filter((p): p is string => typeof p === "string")
      : [],
  };

  return {
    modelDefaults,
    session: sessionConfig,
    compaction: compactionConfig,
    security,
  };
}

/* ── Mutation helpers ── */

export async function updateModelPrimary(
  client: GatewayClient,
  modelKey: string,
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const agents = isRecord(baseConfig.agents) ? baseConfig.agents : {};
      const defaults = isRecord(agents.defaults) ? agents.defaults : {};
      // Preserve existing object fields when setting primary
      const existing = isRecord(defaults.model) ? defaults.model : {};
      return {
        shouldPatch: true,
        patch: { agents: { defaults: { model: { ...existing, primary: modelKey } } } },
        result: undefined,
      };
    },
  });
}

export async function updateModelFallbacks(
  client: GatewayClient,
  fallbacks: string[],
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const agents = isRecord(baseConfig.agents) ? baseConfig.agents : {};
      const defaults = isRecord(agents.defaults) ? agents.defaults : {};
      // Audit fix #1: preserve string value as primary when upgrading to object
      const existing = isRecord(defaults.model)
        ? defaults.model
        : {
            primary:
              typeof defaults.model === "string" ? defaults.model : null,
          };
      return {
        shouldPatch: true,
        patch: { agents: { defaults: { model: { ...existing, fallbacks } } } },
        result: undefined,
      };
    },
  });
}

export async function addCatalogEntry(
  client: GatewayClient,
  key: string,
  alias?: string,
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const agents = isRecord(baseConfig.agents) ? baseConfig.agents : {};
      const defaults = isRecord(agents.defaults) ? agents.defaults : {};
      const models = isRecord(defaults.models) ? { ...defaults.models } : {};
      models[key] = alias ? { alias } : {};
      return {
        shouldPatch: true,
        patch: { agents: { defaults: { models } } },
        result: undefined,
      };
    },
  });
}

export async function removeCatalogEntry(
  client: GatewayClient,
  key: string,
): Promise<void> {
  // Audit fix #2: send null explicitly for deep-merge deletion (not local delete + resend)
  await withGatewayConfigMutation({
    client,
    mutate: () => ({
      shouldPatch: true,
      patch: { agents: { defaults: { models: { [key]: null } } } },
      result: undefined,
    }),
  });
}

export async function updateCatalogAlias(
  client: GatewayClient,
  key: string,
  alias: string,
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig }) => {
      const agents = isRecord(baseConfig.agents) ? baseConfig.agents : {};
      const defaults = isRecord(agents.defaults) ? agents.defaults : {};
      const models = isRecord(defaults.models) ? { ...defaults.models } : {};
      const existing = isRecord(models[key]) ? models[key] : {};
      models[key] = { ...existing, alias };
      return {
        shouldPatch: true,
        patch: { agents: { defaults: { models } } },
        result: undefined,
      };
    },
  });
}

export async function updateSessionDefaults(
  client: GatewayClient,
  sessionPatch: Partial<SessionResetConfig>,
  compactionPatch?: Partial<CompactionConfig>,
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: () => {
      const patch: Record<string, unknown> = {};
      if (Object.keys(sessionPatch).length > 0) {
        patch.session = { reset: sessionPatch };
      }
      if (compactionPatch && Object.keys(compactionPatch).length > 0) {
        patch.agents = { defaults: { compaction: compactionPatch } };
      }
      return { shouldPatch: true, patch, result: undefined };
    },
  });
}

export async function rotateAuthToken(
  client: GatewayClient,
  newToken: string,
): Promise<void> {
  // This will disconnect the current session after success
  await withGatewayConfigMutation({
    client,
    mutate: () => ({
      shouldPatch: true,
      patch: { gateway: { auth: { token: newToken } } },
      result: undefined,
    }),
  });
}
