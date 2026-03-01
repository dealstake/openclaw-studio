/**
 * Autonomy level type definitions and gateway config service.
 *
 * The `autonomyLevel` setting controls how much independence the agent has
 * during a session:
 *  - manual:     Agent pauses and requests approval for each tool call
 *  - plan:       Agent proposes a multi-step plan; user reviews before execution
 *  - autonomous: Agent runs uninterrupted (current default behavior)
 */

import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";
import { upsertConfigAgentEntry, writeConfigAgentList } from "@/lib/gateway/agentConfigTypes";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

// ── Type ─────────────────────────────────────────────────────────────────────

export type AutonomyLevel = "manual" | "plan" | "autonomous";

export const AUTONOMY_LEVELS: AutonomyLevel[] = ["manual", "plan", "autonomous"];

export const AUTONOMY_LEVEL_LABELS: Record<AutonomyLevel, string> = {
  manual: "Manual",
  plan: "Plan",
  autonomous: "Autonomous",
};

export const AUTONOMY_LEVEL_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  manual: "Approve each step before execution",
  plan: "Review a plan before the agent runs",
  autonomous: "Agent runs without interruption",
};

export const DEFAULT_AUTONOMY_LEVEL: AutonomyLevel = "autonomous";

// ── Parser ───────────────────────────────────────────────────────────────────

export function parseAutonomyLevel(value: unknown): AutonomyLevel {
  if (value === "manual" || value === "plan" || value === "autonomous") return value;
  return DEFAULT_AUTONOMY_LEVEL;
}

// ── Gateway service ──────────────────────────────────────────────────────────

/**
 * Persist the agent's autonomy level to `config.agents.list[].autonomyLevel`
 * via a `config.patch` RPC call.
 */
export async function setAgentAutonomyLevel(
  client: GatewayClient,
  agentId: string,
  level: AutonomyLevel,
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: ({ baseConfig, list }) => {
      const { list: nextList } = upsertConfigAgentEntry(list, agentId, (entry) => ({
        ...entry,
        autonomyLevel: level,
      }));
      const patch = writeConfigAgentList(baseConfig, nextList);
      return { shouldPatch: true, patch, result: undefined };
    },
  });
}
