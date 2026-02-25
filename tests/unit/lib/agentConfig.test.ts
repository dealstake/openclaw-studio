import { describe, it, expect, vi } from "vitest";
import {
  readConfigAgentList,
  upsertConfigAgentEntry,
  resolveHeartbeatSettings,
  renameGatewayAgent,
  createGatewayAgent,
  deleteGatewayAgent,
  type ConfigAgentEntry,
} from "@/lib/gateway/agentConfig";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

/* ---------- readConfigAgentList ---------- */
describe("readConfigAgentList", () => {
  it("returns empty for undefined config", () => {
    expect(readConfigAgentList(undefined)).toEqual([]);
  });

  it("returns empty when agents.list is missing", () => {
    expect(readConfigAgentList({})).toEqual([]);
    expect(readConfigAgentList({ agents: {} })).toEqual([]);
  });

  it("filters out non-object and missing-id entries", () => {
    const config = {
      agents: {
        list: [
          { id: "alex", name: "Alex" },
          "not-an-object",
          { name: "no-id" },
          { id: "", name: "empty-id" },
          { id: "  ", name: "whitespace-id" },
          { id: "valid", name: "Valid" },
          null,
        ],
      },
    };
    const result = readConfigAgentList(config);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("alex");
    expect(result[1].id).toBe("valid");
  });

  it("returns valid entries from well-formed config", () => {
    const config = {
      agents: {
        list: [
          { id: "agent-1", name: "Agent One" },
          { id: "agent-2", name: "Agent Two", extra: true },
        ],
      },
    };
    const result = readConfigAgentList(config);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "agent-1", name: "Agent One" });
  });
});

/* ---------- upsertConfigAgentEntry ---------- */
describe("upsertConfigAgentEntry", () => {
  const baseList: ConfigAgentEntry[] = [
    { id: "alex", name: "Alex" },
    { id: "bob", name: "Bob" },
  ];

  it("updates existing entry", () => {
    const { list, entry } = upsertConfigAgentEntry(
      baseList,
      "alex",
      (e) => ({ ...e, name: "Alexander" }),
    );
    expect(list).toHaveLength(2);
    expect(entry.name).toBe("Alexander");
    expect(list[0].name).toBe("Alexander");
  });

  it("inserts new entry when id not found", () => {
    const { list, entry } = upsertConfigAgentEntry(
      baseList,
      "charlie",
      (e) => ({ ...e, name: "Charlie" }),
    );
    expect(list).toHaveLength(3);
    expect(entry.id).toBe("charlie");
    expect(entry.name).toBe("Charlie");
    expect(list[2].id).toBe("charlie");
  });

  it("does not mutate original list", () => {
    upsertConfigAgentEntry(baseList, "alex", (e) => ({ ...e, name: "X" }));
    expect(baseList[0].name).toBe("Alex");
  });
});

/* ---------- resolveHeartbeatSettings ---------- */
describe("resolveHeartbeatSettings", () => {
  it("returns defaults when no agent override", () => {
    const config = {
      agents: {
        defaults: {
          heartbeat: {
            every: "10m",
            target: "custom-target",
            includeReasoning: true,
            ackMaxChars: 500,
          },
        },
        list: [{ id: "alex" }],
      },
    };
    const result = resolveHeartbeatSettings(config, "alex");
    expect(result.heartbeat.every).toBe("10m");
    expect(result.heartbeat.target).toBe("custom-target");
    expect(result.heartbeat.includeReasoning).toBe(true);
    expect(result.heartbeat.ackMaxChars).toBe(500);
    expect(result.hasOverride).toBe(false);
  });

  it("applies agent override over defaults", () => {
    const config = {
      agents: {
        defaults: {
          heartbeat: { every: "10m", target: "default-target" },
        },
        list: [
          { id: "alex", heartbeat: { every: "5m", includeReasoning: true } },
        ],
      },
    };
    const result = resolveHeartbeatSettings(config, "alex");
    expect(result.heartbeat.every).toBe("5m");
    expect(result.heartbeat.includeReasoning).toBe(true);
    expect(result.hasOverride).toBe(true);
  });

  it("returns hardcoded defaults when no config", () => {
    const result = resolveHeartbeatSettings({}, "nonexistent");
    expect(result.heartbeat.every).toBe("30m");
    expect(result.heartbeat.target).toBe("last");
    expect(result.heartbeat.includeReasoning).toBe(false);
    expect(result.heartbeat.ackMaxChars).toBe(300);
    expect(result.heartbeat.activeHours).toBeNull();
    expect(result.hasOverride).toBe(false);
  });

  it("handles activeHours in override", () => {
    const config = {
      agents: {
        list: [
          {
            id: "alex",
            heartbeat: {
              activeHours: { start: "09:00", end: "17:00" },
            },
          },
        ],
      },
    };
    const result = resolveHeartbeatSettings(config, "alex");
    expect(result.heartbeat.activeHours).toEqual({ start: "09:00", end: "17:00" });
  });
});

/* ---------- mutation helpers (with mocked client) ---------- */
function makeMockClient(configSnapshot: Record<string, unknown>) {
  return {
    call: vi.fn().mockImplementation(async (method: string) => {
      if (method === "config.get") {
        return { config: configSnapshot, hash: "test-hash", exists: true };
      }
      if (method === "config.patch") {
        return { ok: true };
      }
      throw new Error(`Unexpected call: ${method}`);
    }),
  } as unknown as GatewayClient;
}

describe("renameGatewayAgent", () => {
  it("throws on empty name", async () => {
    const client = makeMockClient({});
    await expect(
      renameGatewayAgent({ client, agentId: "alex", name: "  " }),
    ).rejects.toThrow("Agent name is required.");
  });

  it("patches config with renamed entry", async () => {
    const client = makeMockClient({
      agents: { list: [{ id: "alex", name: "Alex" }] },
    });
    await renameGatewayAgent({ client, agentId: "alex", name: "Alexander" });
    // First call is config.get, second is config.patch with raw JSON
    expect(client.call).toHaveBeenCalledTimes(2);
    const patchCall = (client.call as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(patchCall[0]).toBe("config.patch");
    const raw = JSON.parse(patchCall[1].raw);
    const renamedEntry = raw.agents.list.find((e: { id: string }) => e.id === "alex");
    expect(renamedEntry.name).toBe("Alexander");
  });
});

describe("createGatewayAgent", () => {
  it("throws on empty name", async () => {
    const client = makeMockClient({});
    await expect(
      createGatewayAgent({ client, name: "" }),
    ).rejects.toThrow("Agent name is required.");
  });

  it("creates agent with slugified id", async () => {
    const client = makeMockClient({
      agents: { list: [{ id: "alex", name: "Alex" }] },
    });
    const result = await createGatewayAgent({ client, name: "New Agent" });
    expect(result.id).toBe("new-agent");
    expect(result.name).toBe("New Agent");
  });

  it("deduplicates id when slug already exists", async () => {
    const client = makeMockClient({
      agents: { list: [{ id: "new-agent", name: "Existing" }] },
    });
    const result = await createGatewayAgent({ client, name: "New Agent" });
    expect(result.id).toBe("new-agent-2");
  });
});

describe("deleteGatewayAgent", () => {
  it("removes agent from list", async () => {
    const client = makeMockClient({
      agents: {
        list: [
          { id: "alex", name: "Alex" },
          { id: "bob", name: "Bob" },
        ],
      },
    });
    await deleteGatewayAgent({ client, agentId: "alex" });
    expect(client.call).toHaveBeenCalledTimes(2);
    const patchCall = (client.call as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(patchCall[0]).toBe("config.patch");
    const raw = JSON.parse(patchCall[1].raw);
    expect(raw.agents.list).toHaveLength(1);
    expect(raw.agents.list[0].id).toBe("bob");
  });

  it("also removes matching bindings", async () => {
    const client = makeMockClient({
      agents: { list: [{ id: "alex", name: "Alex" }] },
      bindings: [
        { agentId: "alex", channel: "gchat" },
        { agentId: "bob", channel: "slack" },
      ],
    });
    await deleteGatewayAgent({ client, agentId: "alex" });
    const patchCall = (client.call as ReturnType<typeof vi.fn>).mock.calls[1];
    const raw = JSON.parse(patchCall[1].raw);
    expect(raw.bindings).toHaveLength(1);
    expect(raw.bindings[0].agentId).toBe("bob");
  });
});
