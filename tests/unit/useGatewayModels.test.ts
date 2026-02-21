import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useGatewayModels } from "@/features/agents/hooks/useGatewayModels";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

vi.mock("@/lib/gateway/GatewayClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/gateway/GatewayClient")>("@/lib/gateway/GatewayClient");
  return {
    ...actual,
    isGatewayDisconnectLikeError: vi.fn(() => false),
  };
});

vi.mock("@/lib/gateway/models", () => ({
  buildGatewayModelChoices: vi.fn((catalog: unknown[]) => catalog),
  resolveConfiguredModelKey: vi.fn((raw: string) => raw),
}));

function makeClient(overrides: Record<string, unknown> = {}): GatewayClient {
  return {
    call: vi.fn(async (method: string) => {
      if (method === "config.get") return { config: { agents: { defaults: { model: "claude" } } } };
      if (method === "models.list") return { models: [{ id: "m1", name: "Model 1" }] };
      return {};
    }),
    ...overrides,
  } as unknown as GatewayClient;
}

describe("useGatewayModels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads models when connected", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useGatewayModels(client, "connected"));

    await waitFor(() => expect(result.current.gatewayModels).toHaveLength(1));
    expect(result.current.gatewayModelsError).toBeNull();
    expect(result.current.gatewayConfigSnapshot).toBeTruthy();
  });

  it("clears models when disconnected", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useGatewayModels(client, "disconnected"));

    // Should remain empty
    await waitFor(() => expect(result.current.gatewayModels).toHaveLength(0));
    expect(result.current.gatewayModelsError).toBeNull();
  });

  it("handles models.list error", async () => {
    const client = makeClient({
      call: vi.fn(async (method: string) => {
        if (method === "config.get") return {};
        if (method === "models.list") throw new Error("Fetch failed");
        return {};
      }),
    });
    const { result } = renderHook(() => useGatewayModels(client, "connected"));

    await waitFor(() => expect(result.current.gatewayModelsError).toBe("Fetch failed"));
    expect(result.current.gatewayModels).toHaveLength(0);
  });

  it("resolveDefaultModelForAgent returns null for empty agentId", () => {
    const client = makeClient();
    const { result } = renderHook(() => useGatewayModels(client, "disconnected"));

    expect(result.current.resolveDefaultModelForAgent("", null)).toBeNull();
    expect(result.current.resolveDefaultModelForAgent("  ", null)).toBeNull();
  });

  it("resolveDefaultModelForAgent resolves agent-level model", () => {
    const client = makeClient();
    const { result } = renderHook(() => useGatewayModels(client, "disconnected"));

    const snapshot = {
      config: {
        agents: {
          defaults: { model: "fallback-model", models: {} },
          list: [{ id: "a1", model: "agent-specific-model" }],
        },
      },
    };

    const resolved = result.current.resolveDefaultModelForAgent("a1", snapshot as never);
    expect(resolved).toBe("agent-specific-model");
  });
});
