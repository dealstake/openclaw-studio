/**
 * contextProfileService — read/write per-agent context profiles from gateway config.
 *
 * Context profiles store per-file injection mode overrides in
 * `config.agents.list[].contextProfile`. Only non-auto entries are persisted;
 * missing entries default to `auto` at read time.
 *
 * Phase 2: Manual per-file context controls.
 */

import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";
import {
  readConfigAgentList,
  upsertConfigAgentEntry,
  writeConfigAgentList,
} from "@/lib/gateway/agentConfigTypes";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";
import { isRecord } from "@/lib/type-guards";
import type { ContextMode, ContextProfile } from "../types";
import { DEFAULT_CONTEXT_MODE } from "../types";

// ── Parsing ───────────────────────────────────────────────────────────────────

/** Parse a raw unknown value into a validated ContextProfile. */
export function parseContextProfile(raw: unknown): ContextProfile {
  if (!isRecord(raw)) return {};
  const profile: ContextProfile = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val === "always" || val === "auto" || val === "never") {
      profile[key] = val as ContextMode;
    }
  }
  return profile;
}

/** Extract the context profile for an agent from a config snapshot. */
export function readContextProfileFromSnapshot(
  snapshot: GatewayConfigSnapshot,
  agentId: string,
): ContextProfile {
  const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
  const list = readConfigAgentList(baseConfig);
  const entry = list.find((e) => e.id === agentId);
  if (!entry) return {};
  return parseContextProfile((entry as Record<string, unknown>).contextProfile);
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Persist a context profile to gateway config.
 *
 * Cleans the profile before writing — removes any entries that equal the default
 * mode (`auto`) to keep stored config compact.
 */
export async function setContextProfile(
  client: GatewayClient,
  agentId: string,
  profile: ContextProfile,
): Promise<void> {
  // Strip default-mode entries before persisting
  const compact: ContextProfile = {};
  for (const [path, mode] of Object.entries(profile)) {
    if (mode !== DEFAULT_CONTEXT_MODE) {
      compact[path] = mode;
    }
  }

  await withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig, list }) => {
      const { list: nextList } = upsertConfigAgentEntry(list, agentId, (entry) => ({
        ...entry,
        contextProfile: compact,
      }));
      const patch = writeConfigAgentList(baseConfig, nextList);
      return { shouldPatch: true, patch, result: undefined };
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the effective context mode for a file path, defaulting to `auto`. */
export function getEffectiveMode(profile: ContextProfile, filePath: string): ContextMode {
  return profile[filePath] ?? DEFAULT_CONTEXT_MODE;
}

/**
 * Return an updated profile with a new mode for the given path.
 * If the new mode is `auto`, the entry is removed (auto is the default).
 */
export function applyModeChange(
  profile: ContextProfile,
  filePath: string,
  mode: ContextMode,
): ContextProfile {
  if (mode === DEFAULT_CONTEXT_MODE) {
    const next = { ...profile };
    delete next[filePath];
    return next;
  }
  return { ...profile, [filePath]: mode };
}
