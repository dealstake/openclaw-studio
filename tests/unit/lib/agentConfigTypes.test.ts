import { describe, it, expect } from "vitest";
import {
  readConfigAgentList,
  writeConfigAgentList,
  upsertConfigAgentEntry,
} from "@/lib/gateway/agentConfigTypes";

describe("readConfigAgentList", () => {
  it("returns empty array for undefined config", () => {
    expect(readConfigAgentList(undefined)).toEqual([]);
  });

  it("returns empty array for config without agents", () => {
    expect(readConfigAgentList({})).toEqual([]);
    expect(readConfigAgentList({ agents: "invalid" })).toEqual([]);
  });

  it("returns empty array for agents without list", () => {
    expect(readConfigAgentList({ agents: {} })).toEqual([]);
    expect(readConfigAgentList({ agents: { list: "not-array" } })).toEqual([]);
  });

  it("filters out non-object entries", () => {
    const config = { agents: { list: ["string", 42, null, { id: "alex" }] } };
    expect(readConfigAgentList(config)).toEqual([{ id: "alex" }]);
  });

  it("filters out entries without string id", () => {
    const config = { agents: { list: [{ id: 42 }, { id: "" }, { id: " " }, { id: "valid" }] } };
    expect(readConfigAgentList(config)).toEqual([{ id: "valid" }]);
  });

  it("returns valid entries with extra fields", () => {
    const config = { agents: { list: [{ id: "alex", name: "Alex", model: "opus" }] } };
    const result = readConfigAgentList(config);
    expect(result).toEqual([{ id: "alex", name: "Alex", model: "opus" }]);
  });
});

describe("writeConfigAgentList", () => {
  it("creates agents object if missing", () => {
    const result = writeConfigAgentList({}, [{ id: "alex" }]);
    expect(result).toEqual({ agents: { list: [{ id: "alex" }] } });
  });

  it("preserves existing agents fields", () => {
    const config = { agents: { defaults: { model: "opus" }, list: [{ id: "old" }] } };
    const result = writeConfigAgentList(config, [{ id: "new" }]);
    expect(result.agents).toEqual({ defaults: { model: "opus" }, list: [{ id: "new" }] });
  });

  it("preserves non-agents config", () => {
    const config = { bindings: [], agents: { list: [] } };
    const result = writeConfigAgentList(config, [{ id: "alex" }]);
    expect(result.bindings).toEqual([]);
  });
});

describe("upsertConfigAgentEntry", () => {
  it("updates existing entry", () => {
    const list = [{ id: "alex", name: "Old" }];
    const { list: next, entry } = upsertConfigAgentEntry(list, "alex", (e) => ({ ...e, name: "New" }));
    expect(next).toHaveLength(1);
    expect(entry).toEqual({ id: "alex", name: "New" });
    expect(next[0]).toBe(entry);
  });

  it("appends new entry if not found", () => {
    const list = [{ id: "alex" }];
    const { list: next, entry } = upsertConfigAgentEntry(list, "bob", (e) => ({ ...e, name: "Bob" }));
    expect(next).toHaveLength(2);
    expect(entry).toEqual({ id: "bob", name: "Bob" });
  });

  it("preserves other entries unchanged", () => {
    const list = [{ id: "alex" }, { id: "bob" }];
    const { list: next } = upsertConfigAgentEntry(list, "alex", (e) => ({ ...e, name: "Updated" }));
    expect(next[1]).toEqual({ id: "bob" });
  });
});
