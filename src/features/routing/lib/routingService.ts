/**
 * Smart Model Router — Service layer.
 *
 * Reads and writes routing rules from/to the `routing.rules` path in gateway config.
 * Uses withGatewayConfigMutation for safe config.patch with hash-based conflict detection.
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";
import { isRecord } from "@/lib/type-guards";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";
import type { RoutingCondition, RoutingRule, RoutingConfig, TaskTypeConditionValue } from "./types";

const VALID_TASK_TYPES = new Set<TaskTypeConditionValue>(["cron", "subagent", "main", "heartbeat", "any"]);

/** Parse a single condition from raw config data */
function parseCondition(c: unknown): RoutingCondition | null {
  if (!isRecord(c)) return null;
  if (c.type === "taskType" && typeof c.value === "string" && VALID_TASK_TYPES.has(c.value as TaskTypeConditionValue)) {
    return { type: "taskType", value: c.value as TaskTypeConditionValue };
  }
  if (c.type === "agentId" && typeof c.value === "string" && c.value) {
    return { type: "agentId", value: c.value };
  }
  return null;
}

/** Parse the routing section from a raw config snapshot */
export function parseRoutingConfig(
  snapshot: GatewayConfigSnapshot,
): RoutingConfig {
  const config = isRecord(snapshot.config) ? snapshot.config : {};
  const routing = isRecord(config.routing) ? config.routing : {};
  const rawRules = Array.isArray(routing.rules) ? routing.rules : [];

  const rules: RoutingRule[] = rawRules.flatMap((r): RoutingRule[] => {
    if (!isRecord(r) || typeof r.id !== "string" || !r.id) return [];
    const conditions: RoutingCondition[] = Array.isArray(r.conditions)
      ? r.conditions.flatMap((c): RoutingCondition[] => {
          const parsed = parseCondition(c);
          return parsed ? [parsed] : [];
        })
      : [];
    return [
      {
        id: r.id,
        name: typeof r.name === "string" ? r.name : "Unnamed rule",
        enabled: r.enabled !== false,
        conditions,
        model: typeof r.model === "string" ? r.model : "",
      },
    ];
  });

  return { rules };
}

/** Save the full set of routing rules to gateway config */
export async function saveRoutingRules(
  client: GatewayClient,
  rules: RoutingRule[],
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: () => ({
      shouldPatch: true,
      patch: { routing: { rules } },
      result: undefined,
    }),
  });
}

/** Add a single rule (appends to existing list) */
export async function addRoutingRule(
  client: GatewayClient,
  rule: RoutingRule,
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: ({ snapshot }) => {
      const existing = parseRoutingConfig(snapshot);
      return {
        shouldPatch: true,
        patch: { routing: { rules: [...existing.rules, rule] } },
        result: undefined,
      };
    },
  });
}

/** Update a rule by ID */
export async function updateRoutingRule(
  client: GatewayClient,
  ruleId: string,
  updates: Partial<Omit<RoutingRule, "id">>,
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: ({ snapshot }) => {
      const existing = parseRoutingConfig(snapshot);
      const rules = existing.rules.map((r) =>
        r.id === ruleId ? { ...r, ...updates } : r,
      );
      return {
        shouldPatch: true,
        patch: { routing: { rules } },
        result: undefined,
      };
    },
  });
}

/** Delete a rule by ID */
export async function deleteRoutingRule(
  client: GatewayClient,
  ruleId: string,
): Promise<void> {
  await withGatewayConfigMutation({
    client,
    mutate: ({ snapshot }) => {
      const existing = parseRoutingConfig(snapshot);
      const rules = existing.rules.filter((r) => r.id !== ruleId);
      return {
        shouldPatch: true,
        patch: { routing: { rules } },
        result: undefined,
      };
    },
  });
}
