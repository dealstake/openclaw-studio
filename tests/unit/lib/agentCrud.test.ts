import { describe, it, expect, vi } from "vitest";
import {
  createGatewayAgent,
  renameGatewayAgent,
  deleteGatewayAgent,
} from "@/lib/gateway/agentCrud";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";

const snapshot = (
  list: Array<Record<string, unknown>> = [],
  bindings: unknown[] = []
): GatewayConfigSnapshot => ({
  config: { agents: { list }, bindings },
  hash: "test-hash",
  exists: true,
});

const mockClient = (initialSnapshot: GatewayConfigSnapshot) => ({
  call: vi.fn(async (method: string) => {
    if (method === "config.get") return initialSnapshot;
    if (method === "config.patch") return { ok: true };
    throw new Error(`Unexpected: ${method}`);
  }),
});

describe("createGatewayAgent", () => {
  it("creates agent with slugified ID", async () => {
    const client = mockClient(snapshot());
    const result = await createGatewayAgent({ client: client as never, name: "My Agent" });
    expect(result.id).toBe("my-agent");
    expect(result.name).toBe("My Agent");
    expect(client.call).toHaveBeenCalledWith("config.patch", expect.anything());
  });

  it("deduplicates ID on collision", async () => {
    const client = mockClient(snapshot([{ id: "alex" }]));
    const result = await createGatewayAgent({ client: client as never, name: "Alex" });
    expect(result.id).toBe("alex-2");
  });

  it("rejects empty name", async () => {
    const client = mockClient(snapshot());
    await expect(createGatewayAgent({ client: client as never, name: "" })).rejects.toThrow("required");
    await expect(createGatewayAgent({ client: client as never, name: "   " })).rejects.toThrow("required");
  });
});

describe("renameGatewayAgent", () => {
  it("renames existing agent", async () => {
    const client = mockClient(snapshot([{ id: "alex", name: "Old" }]));
    const result = await renameGatewayAgent({ client: client as never, agentId: "alex", name: "New Name" });
    expect(result.name).toBe("New Name");
  });

  it("creates entry if agent not found (upsert)", async () => {
    const client = mockClient(snapshot());
    const result = await renameGatewayAgent({ client: client as never, agentId: "new-agent", name: "Brand New" });
    expect(result.id).toBe("new-agent");
    expect(result.name).toBe("Brand New");
  });

  it("rejects empty name", async () => {
    const client = mockClient(snapshot());
    await expect(renameGatewayAgent({ client: client as never, agentId: "alex", name: "" })).rejects.toThrow("required");
  });
});

describe("deleteGatewayAgent", () => {
  it("removes agent and associated bindings", async () => {
    const client = mockClient(snapshot(
      [{ id: "alex" }, { id: "bob" }],
      [{ agentId: "alex", channel: "whatsapp" }, { agentId: "bob", channel: "telegram" }]
    ));
    const result = await deleteGatewayAgent({ client: client as never, agentId: "alex" });
    expect(result.removed).toBe(true);
    expect(result.removedBindings).toBe(1);

    // Verify patch was called (agent removed + binding removed)
    expect(client.call).toHaveBeenCalledWith("config.patch", expect.anything());
  });

  it("returns removed=false when agent doesn't exist", async () => {
    const client = mockClient(snapshot([{ id: "bob" }]));
    const result = await deleteGatewayAgent({ client: client as never, agentId: "nonexistent" });
    expect(result.removed).toBe(false);
    expect(result.removedBindings).toBe(0);
    // Should not call config.patch
    expect(client.call).toHaveBeenCalledTimes(1); // only config.get
  });
});
