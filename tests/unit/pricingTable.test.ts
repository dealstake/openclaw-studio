import { describe, it, expect } from "vitest";
import { getModelPricing, getModelDisplayName } from "@/features/usage/lib/pricingTable";

describe("getModelPricing", () => {
  it("returns pricing for exact model match", () => {
    const p = getModelPricing("claude-opus-4-0620");
    expect(p).toEqual({ inputPer1M: 15, outputPer1M: 75 });
  });

  it("strips provider prefix", () => {
    const p = getModelPricing("anthropic/claude-opus-4-0620");
    expect(p).toEqual({ inputPer1M: 15, outputPer1M: 75 });
  });

  it("handles sonnet 4 pricing", () => {
    const p = getModelPricing("anthropic/claude-sonnet-4-0514");
    expect(p).toEqual({ inputPer1M: 3, outputPer1M: 15 });
  });

  it("handles haiku 3.5 pricing", () => {
    const p = getModelPricing("claude-haiku-3.5");
    expect(p).toEqual({ inputPer1M: 0.8, outputPer1M: 4 });
  });

  it("fuzzy matches versioned model strings", () => {
    const p = getModelPricing("claude-opus-4-0620-preview");
    expect(p).not.toBeNull();
    expect(p!.inputPer1M).toBe(15);
  });

  it("returns null for unknown models", () => {
    expect(getModelPricing("gpt-4o")).toBeNull();
  });

  it("is case-insensitive", () => {
    const p = getModelPricing("Claude-Opus-4-0620");
    expect(p).not.toBeNull();
  });
});

describe("getModelDisplayName", () => {
  it("returns Opus 4 for opus models", () => {
    expect(getModelDisplayName("anthropic/claude-opus-4-0620")).toBe("Opus 4");
  });

  it("returns Sonnet 4 for sonnet-4 models", () => {
    expect(getModelDisplayName("anthropic/claude-sonnet-4-0514")).toBe("Sonnet 4");
  });

  it("returns Sonnet 3.5 for sonnet-3 models", () => {
    expect(getModelDisplayName("claude-3-5-sonnet-20241022")).toBe("Sonnet 3.5");
  });

  it("returns Haiku 3.5 for haiku-3.5 models", () => {
    expect(getModelDisplayName("claude-haiku-3.5")).toBe("Haiku 3.5");
  });

  it("returns Haiku 3 for plain haiku models", () => {
    expect(getModelDisplayName("claude-3-haiku-20240307")).toBe("Haiku 3");
  });

  it("returns normalized string for unknown models", () => {
    expect(getModelDisplayName("openai/gpt-4o")).toBe("gpt-4o");
  });
});
