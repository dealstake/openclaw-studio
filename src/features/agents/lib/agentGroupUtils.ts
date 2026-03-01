/**
 * agentGroupUtils — Group and tag utilities for agent organization.
 *
 * Phase 1 of the Agent Groups & Organization feature.
 * These functions provide the data-layer equivalent of CLI `--group` / `--tag` filtering.
 *
 * Usage:
 *   filterAgentsByGroup(agents, "ops")      → agents in the "ops" group
 *   filterAgentsByTag(agents, "monitoring") → agents with the "monitoring" tag
 *   getAgentGroups(agents)                  → ["ops", "dev", "data"] (sorted, unique)
 *   getAgentTags(agents)                    → ["critical", "monitoring"] (sorted, unique)
 *   groupAgentsByGroup(agents)              → Map<group | null, agents[]>
 */

export type AgentWithGrouping = {
  agentId: string;
  group?: string | null;
  tags?: string[];
};

/** The sentinel key used for agents with no group. */
export const UNGROUPED_KEY = "__ungrouped__" as const;

/**
 * Filter agents to only those in the given group (case-insensitive).
 * Passing `null` or `undefined` returns agents with no group.
 */
export function filterAgentsByGroup<T extends AgentWithGrouping>(
  agents: T[],
  group: string | null | undefined
): T[] {
  if (group == null) {
    return agents.filter((a) => !a.group);
  }
  const lower = group.toLowerCase();
  return agents.filter((a) => typeof a.group === "string" && a.group.toLowerCase() === lower);
}

/**
 * Filter agents to those that include the given tag (case-insensitive).
 */
export function filterAgentsByTag<T extends AgentWithGrouping>(
  agents: T[],
  tag: string
): T[] {
  const lower = tag.toLowerCase();
  return agents.filter(
    (a) =>
      Array.isArray(a.tags) &&
      a.tags.some((t) => typeof t === "string" && t.toLowerCase() === lower)
  );
}

/**
 * Returns all unique, non-empty group names across the given agents.
 * Result is sorted alphabetically.
 */
export function getAgentGroups<T extends AgentWithGrouping>(agents: T[]): string[] {
  const seen = new Set<string>();
  for (const agent of agents) {
    if (typeof agent.group === "string" && agent.group.trim()) {
      seen.add(agent.group.trim());
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/**
 * Returns all unique, non-empty tags across the given agents.
 * Result is sorted alphabetically.
 */
export function getAgentTags<T extends AgentWithGrouping>(agents: T[]): string[] {
  const seen = new Set<string>();
  for (const agent of agents) {
    if (!Array.isArray(agent.tags)) continue;
    for (const tag of agent.tags) {
      if (typeof tag === "string" && tag.trim()) {
        seen.add(tag.trim());
      }
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/**
 * Bucket agents into groups.
 *
 * Returns a `Map` where each key is a group name (or `UNGROUPED_KEY` for agents
 * with no group) and the value is the ordered list of agents in that bucket.
 *
 * The map preserves insertion order: named groups appear first (sorted
 * alphabetically), then the ungrouped bucket last (if non-empty).
 */
export function groupAgentsByGroup<T extends AgentWithGrouping>(
  agents: T[]
): Map<string, T[]> {
  const groups = getAgentGroups(agents);
  const result = new Map<string, T[]>();

  for (const group of groups) {
    result.set(group, filterAgentsByGroup(agents, group));
  }

  const ungrouped = filterAgentsByGroup(agents, null);
  if (ungrouped.length > 0) {
    result.set(UNGROUPED_KEY, ungrouped);
  }

  return result;
}

/**
 * Checks whether an agent matches a group filter.
 * Pass `null` to match ungrouped agents; pass a string for named groups (case-insensitive).
 */
export function agentMatchesGroup<T extends AgentWithGrouping>(
  agent: T,
  group: string | null
): boolean {
  if (group === null) return !agent.group;
  if (typeof agent.group !== "string") return false;
  return agent.group.toLowerCase() === group.toLowerCase();
}

/**
 * Checks whether an agent has a given tag (case-insensitive).
 */
export function agentHasTag<T extends AgentWithGrouping>(agent: T, tag: string): boolean {
  if (!Array.isArray(agent.tags)) return false;
  const lower = tag.toLowerCase();
  return agent.tags.some((t) => typeof t === "string" && t.toLowerCase() === lower);
}
