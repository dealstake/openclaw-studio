import { describe, it, expect } from "vitest";
import {
  resolveConfiguredModelKey,
  buildAllowedModelKeys,
  buildGatewayModelChoices,
  type GatewayModelChoice,
  type GatewayModelPolicySnapshot,
} from "@/lib/gateway/models";

describe("resolveConfiguredModelKey", () => {
  it("returns null for empty string", () => {
    expect(resolveConfiguredModelKey("")).toBeNull();
    expect(resolveConfiguredModelKey("  ")).toBeNull();
  });

  it("returns already-qualified keys as-is", () => {
    expect(resolveConfiguredModelKey("anthropic/claude-opus-4-6")).toBe("anthropic/claude-opus-4-6");
  });

  it("prefixes bare names with anthropic/", () => {
    expect(resolveConfiguredModelKey("claude-opus-4-6")).toBe("anthropic/claude-opus-4-6");
  });

  it("resolves alias lookups (case-insensitive)", () => {
    const models = { "anthropic/claude-opus-4-6": { alias: "opus" } };
    expect(resolveConfiguredModelKey("Opus", models)).toBe("anthropic/claude-opus-4-6");
    expect(resolveConfiguredModelKey("opus", models)).toBe("anthropic/claude-opus-4-6");
  });

  it("falls back to anthropic/ prefix when alias not found", () => {
    const models = { "anthropic/claude-opus-4-6": { alias: "opus" } };
    expect(resolveConfiguredModelKey("sonnet", models)).toBe("anthropic/sonnet");
  });
});

describe("buildAllowedModelKeys", () => {
  it("returns empty for null snapshot", () => {
    expect(buildAllowedModelKeys(null)).toEqual([]);
  });

  it("handles string model default", () => {
    const snapshot: GatewayModelPolicySnapshot = {
      config: { agents: { defaults: { model: "anthropic/claude-opus-4-6" } } },
    };
    expect(buildAllowedModelKeys(snapshot)).toEqual(["anthropic/claude-opus-4-6"]);
  });

  it("handles object model with primary + fallbacks", () => {
    const snapshot: GatewayModelPolicySnapshot = {
      config: {
        agents: {
          defaults: {
            model: {
              primary: "anthropic/claude-opus-4-6",
              fallbacks: ["anthropic/claude-sonnet-4-6"],
            },
          },
        },
      },
    };
    const keys = buildAllowedModelKeys(snapshot);
    expect(keys).toContain("anthropic/claude-opus-4-6");
    expect(keys).toContain("anthropic/claude-sonnet-4-6");
  });

  it("includes model alias keys", () => {
    const snapshot: GatewayModelPolicySnapshot = {
      config: {
        agents: {
          defaults: {
            models: { "google/gemini-2.5-flash": { alias: "flash" } },
          },
        },
      },
    };
    expect(buildAllowedModelKeys(snapshot)).toContain("google/gemini-2.5-flash");
  });

  it("deduplicates keys", () => {
    const snapshot: GatewayModelPolicySnapshot = {
      config: {
        agents: {
          defaults: {
            model: "anthropic/claude-opus-4-6",
            models: { "anthropic/claude-opus-4-6": { alias: "opus" } },
          },
        },
      },
    };
    const keys = buildAllowedModelKeys(snapshot);
    expect(keys.filter((k) => k === "anthropic/claude-opus-4-6")).toHaveLength(1);
  });
});

describe("buildGatewayModelChoices", () => {
  const catalog: GatewayModelChoice[] = [
    { id: "claude-opus-4-6", name: "Claude Opus", provider: "anthropic", contextWindow: 200000 },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet", provider: "anthropic", contextWindow: 200000 },
    { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  ];

  it("returns full catalog when no snapshot", () => {
    expect(buildGatewayModelChoices(catalog, null)).toEqual(catalog);
  });

  it("filters to allowed models", () => {
    const snapshot: GatewayModelPolicySnapshot = {
      config: { agents: { defaults: { model: "anthropic/claude-opus-4-6" } } },
    };
    const choices = buildGatewayModelChoices(catalog, snapshot);
    expect(choices).toHaveLength(1);
    expect(choices[0].id).toBe("claude-opus-4-6");
  });

  it("adds extras for allowed models not in catalog", () => {
    const snapshot: GatewayModelPolicySnapshot = {
      config: { agents: { defaults: { model: "google/gemini-2.5-flash" } } },
    };
    const choices = buildGatewayModelChoices(catalog, snapshot);
    expect(choices).toHaveLength(1);
    expect(choices[0].id).toBe("gemini-2.5-flash");
    expect(choices[0].name).toBe("Gemini 2.5 Flash");
    expect(choices[0].contextWindow).toBe(1000000);
  });

  it("applies fallback context windows", () => {
    const noCwCatalog: GatewayModelChoice[] = [
      { id: "claude-opus-4-6", name: "Claude Opus", provider: "anthropic" },
    ];
    const snapshot: GatewayModelPolicySnapshot = {
      config: { agents: { defaults: { model: "anthropic/claude-opus-4-6" } } },
    };
    const choices = buildGatewayModelChoices(noCwCatalog, snapshot);
    expect(choices[0].contextWindow).toBe(200000);
  });
});
