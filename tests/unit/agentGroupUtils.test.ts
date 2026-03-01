import { describe, it, expect } from "vitest";
import {
  filterAgentsByGroup,
  filterAgentsByTag,
  getAgentGroups,
  getAgentTags,
  groupAgentsByGroup,
  agentMatchesGroup,
  agentHasTag,
  UNGROUPED_KEY,
} from "@/features/agents/lib/agentGroupUtils";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const agents = [
  { agentId: "alex",  group: "dev",  tags: ["coding", "critical"] },
  { agentId: "sam",   group: "ops",  tags: ["monitoring", "critical"] },
  { agentId: "casey", group: "ops",  tags: ["monitoring"] },
  { agentId: "riley", group: null,   tags: ["misc"] },
  { agentId: "quinn", group: null,   tags: [] },
  { agentId: "pat",   group: "data", tags: ["analytics"] },
];

// ── filterAgentsByGroup ───────────────────────────────────────────────────────

describe("filterAgentsByGroup", () => {
  it("returns agents in the named group (exact match)", () => {
    const result = filterAgentsByGroup(agents, "ops");
    expect(result.map((a) => a.agentId)).toEqual(["sam", "casey"]);
  });

  it("is case-insensitive", () => {
    const result = filterAgentsByGroup(agents, "OPS");
    expect(result.map((a) => a.agentId)).toEqual(["sam", "casey"]);
  });

  it("returns ungrouped agents when group is null", () => {
    const result = filterAgentsByGroup(agents, null);
    expect(result.map((a) => a.agentId)).toEqual(["riley", "quinn"]);
  });

  it("returns ungrouped agents when group is undefined", () => {
    const result = filterAgentsByGroup(agents, undefined);
    expect(result.map((a) => a.agentId)).toEqual(["riley", "quinn"]);
  });

  it("returns empty array when no agents match", () => {
    expect(filterAgentsByGroup(agents, "nonexistent")).toEqual([]);
  });
});

// ── filterAgentsByTag ─────────────────────────────────────────────────────────

describe("filterAgentsByTag", () => {
  it("returns agents with the given tag", () => {
    const result = filterAgentsByTag(agents, "monitoring");
    expect(result.map((a) => a.agentId)).toEqual(["sam", "casey"]);
  });

  it("is case-insensitive", () => {
    const result = filterAgentsByTag(agents, "CRITICAL");
    expect(result.map((a) => a.agentId)).toEqual(["alex", "sam"]);
  });

  it("returns empty array when no agents match", () => {
    expect(filterAgentsByTag(agents, "nonexistent")).toEqual([]);
  });

  it("handles agents with no tags array", () => {
    const withMissing = [{ agentId: "x" }, ...agents];
    // Should not throw; "x" simply has no tags
    const result = filterAgentsByTag(withMissing, "coding");
    expect(result.map((a) => a.agentId)).toEqual(["alex"]);
  });
});

// ── getAgentGroups ────────────────────────────────────────────────────────────

describe("getAgentGroups", () => {
  it("returns sorted unique group names, excluding null/ungrouped", () => {
    const groups = getAgentGroups(agents);
    expect(groups).toEqual(["data", "dev", "ops"]);
  });

  it("returns empty array when all agents are ungrouped", () => {
    const ungrouped = [
      { agentId: "a", group: null, tags: [] },
      { agentId: "b", group: undefined, tags: [] },
    ];
    expect(getAgentGroups(ungrouped)).toEqual([]);
  });

  it("deduplicates groups", () => {
    const dupes = [
      { agentId: "a", group: "ops", tags: [] },
      { agentId: "b", group: "ops", tags: [] },
      { agentId: "c", group: "dev", tags: [] },
    ];
    expect(getAgentGroups(dupes)).toEqual(["dev", "ops"]);
  });
});

// ── getAgentTags ──────────────────────────────────────────────────────────────

describe("getAgentTags", () => {
  it("returns sorted unique tags across all agents", () => {
    const tags = getAgentTags(agents);
    expect(tags).toEqual(["analytics", "coding", "critical", "misc", "monitoring"]);
  });

  it("returns empty array when no agents have tags", () => {
    const noTags = [{ agentId: "a", group: "ops", tags: [] }];
    expect(getAgentTags(noTags)).toEqual([]);
  });
});

// ── groupAgentsByGroup ────────────────────────────────────────────────────────

describe("groupAgentsByGroup", () => {
  it("returns a map with named groups sorted, ungrouped last", () => {
    const map = groupAgentsByGroup(agents);
    const keys = Array.from(map.keys());
    expect(keys).toEqual(["data", "dev", "ops", UNGROUPED_KEY]);
  });

  it("places ungrouped agents under UNGROUPED_KEY", () => {
    const map = groupAgentsByGroup(agents);
    const ungrouped = map.get(UNGROUPED_KEY) ?? [];
    expect(ungrouped.map((a) => a.agentId)).toEqual(["riley", "quinn"]);
  });

  it("omits UNGROUPED_KEY when all agents have groups", () => {
    const all = [
      { agentId: "a", group: "ops", tags: [] },
      { agentId: "b", group: "dev", tags: [] },
    ];
    const map = groupAgentsByGroup(all);
    expect(map.has(UNGROUPED_KEY)).toBe(false);
  });

  it("includes only UNGROUPED_KEY when all agents are ungrouped", () => {
    const all = [
      { agentId: "a", group: null, tags: [] },
      { agentId: "b", group: null, tags: [] },
    ];
    const map = groupAgentsByGroup(all);
    expect(Array.from(map.keys())).toEqual([UNGROUPED_KEY]);
  });

  it("returns empty map for empty agents array", () => {
    const map = groupAgentsByGroup([]);
    expect(map.size).toBe(0);
  });
});

// ── agentMatchesGroup ─────────────────────────────────────────────────────────

describe("agentMatchesGroup", () => {
  it("matches a named group case-insensitively", () => {
    expect(agentMatchesGroup({ agentId: "a", group: "Ops" }, "ops")).toBe(true);
    expect(agentMatchesGroup({ agentId: "a", group: "ops" }, "OPS")).toBe(true);
  });

  it("does not match wrong group", () => {
    expect(agentMatchesGroup({ agentId: "a", group: "dev" }, "ops")).toBe(false);
  });

  it("matches null group when agent has no group", () => {
    expect(agentMatchesGroup({ agentId: "a", group: null }, null)).toBe(true);
    expect(agentMatchesGroup({ agentId: "a" }, null)).toBe(true);
  });

  it("does not match null group when agent has a group", () => {
    expect(agentMatchesGroup({ agentId: "a", group: "ops" }, null)).toBe(false);
  });
});

// ── agentHasTag ───────────────────────────────────────────────────────────────

describe("agentHasTag", () => {
  it("returns true when agent has the tag (case-insensitive)", () => {
    expect(agentHasTag({ agentId: "a", tags: ["monitoring"] }, "MONITORING")).toBe(true);
    expect(agentHasTag({ agentId: "a", tags: ["Critical"] }, "critical")).toBe(true);
  });

  it("returns false when agent does not have the tag", () => {
    expect(agentHasTag({ agentId: "a", tags: ["monitoring"] }, "critical")).toBe(false);
  });

  it("returns false when tags array is empty", () => {
    expect(agentHasTag({ agentId: "a", tags: [] }, "monitoring")).toBe(false);
  });

  it("returns false when tags is missing", () => {
    expect(agentHasTag({ agentId: "a" }, "monitoring")).toBe(false);
  });
});
