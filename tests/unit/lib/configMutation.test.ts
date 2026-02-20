import { describe, it, expect, vi } from "vitest";
import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";
import { GatewayResponseError } from "@/lib/gateway/GatewayClient";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";

const mockClient = (responses: Record<string, unknown>) => ({
  call: vi.fn(async (method: string) => {
    if (method in responses) return responses[method];
    throw new Error(`Unexpected RPC: ${method}`);
  }),
});

const snapshot = (
  config: Record<string, unknown> = {},
  hash = "abc123"
): GatewayConfigSnapshot => ({
  config,
  hash,
  exists: true,
});

describe("withGatewayConfigMutation", () => {
  it("calls config.get and applies patch when shouldPatch=true", async () => {
    const client = mockClient({
      "config.get": snapshot({ agents: { list: [] } }),
      "config.patch": { ok: true },
    });

    const result = await withGatewayConfigMutation({
      client: client as never,
      mutate: ({ list }) => ({
        shouldPatch: true,
        patch: { agents: { list: [...list, { id: "new" }] } },
        result: "created",
      }),
    });

    expect(result).toBe("created");
    expect(client.call).toHaveBeenCalledWith("config.get", {});
    expect(client.call).toHaveBeenCalledWith("config.patch", expect.objectContaining({
      baseHash: "abc123",
    }));
  });

  it("skips patch when shouldPatch=false", async () => {
    const client = mockClient({
      "config.get": snapshot(),
    });

    const result = await withGatewayConfigMutation({
      client: client as never,
      mutate: () => ({ shouldPatch: false, result: "noop" }),
    });

    expect(result).toBe("noop");
    expect(client.call).toHaveBeenCalledTimes(1); // only config.get
  });

  it("retries on hash mismatch error", async () => {
    let patchAttempt = 0;
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "config.get") {
          return snapshot({ agents: { list: [] } }, patchAttempt === 0 ? "old-hash" : "new-hash");
        }
        if (method === "config.patch") {
          patchAttempt++;
          if (patchAttempt === 1) {
            throw new GatewayResponseError({ code: "HASH_MISMATCH", message: "config changed since last load — re-run config.get" });
          }
          return { ok: true };
        }
        throw new Error(`Unexpected: ${method}`);
      }),
    };

    const result = await withGatewayConfigMutation({
      client: client as never,
      mutate: () => ({
        shouldPatch: true,
        patch: { test: true },
        result: "retried",
      }),
    });

    expect(result).toBe("retried");
    // config.get called twice (initial + retry), config.patch called twice
    expect(client.call).toHaveBeenCalledTimes(4);
  });

  it("throws non-retryable errors", async () => {
    const client = mockClient({
      "config.get": snapshot(),
    });
    client.call.mockImplementation(async (method: string) => {
      if (method === "config.get") return snapshot();
      throw new Error("Network failure");
    });

    await expect(
      withGatewayConfigMutation({
        client: client as never,
        mutate: () => ({
          shouldPatch: true,
          patch: { test: true },
          result: "fail",
        }),
      })
    ).rejects.toThrow("Network failure");
  });

  it("passes sessionKey through to config.patch", async () => {
    const client = mockClient({
      "config.get": snapshot(),
      "config.patch": { ok: true },
    });

    await withGatewayConfigMutation({
      client: client as never,
      sessionKey: "my-session",
      mutate: () => ({
        shouldPatch: true,
        patch: { foo: "bar" },
        result: "ok",
      }),
    });

    expect(client.call).toHaveBeenCalledWith("config.patch", expect.objectContaining({
      sessionKey: "my-session",
    }));
  });

  it("provides agent list from config to mutate callback", async () => {
    const agentList = [{ id: "alex", name: "Alex" }];
    const client = mockClient({
      "config.get": snapshot({ agents: { list: agentList } }),
    });

    await withGatewayConfigMutation({
      client: client as never,
      mutate: ({ list }) => {
        expect(list).toEqual(agentList);
        return { shouldPatch: false, result: "checked" };
      },
    });
  });
});
