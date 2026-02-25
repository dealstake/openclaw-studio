import { describe, expect, it } from "vitest";
import {
  getModelPricing,
  getModelDisplayName,
} from "@/features/usage/lib/pricingTable";

describe("getModelPricing", () => {
  it("returns pricing for direct match", () => {
    const p = getModelPricing("claude-opus-4");
    expect(p).toEqual({ inputPer1M: 15, outputPer1M: 75 });
  });

  it("strips provider prefix", () => {
    const p = getModelPricing("anthropic/claude-opus-4-0620");
    expect(p).toEqual({ inputPer1M: 15, outputPer1M: 75 });
  });

  it("handles sonnet 4 variants", () => {
    expect(getModelPricing("claude-sonnet-4")).toEqual({ inputPer1M: 3, outputPer1M: 15 });
    expect(getModelPricing("anthropic/claude-sonnet-4-0514")).toEqual({ inputPer1M: 3, outputPer1M: 15 });
  });

  it("handles haiku 3.5", () => {
    const p = getModelPricing("claude-haiku-3.5");
    expect(p).toEqual({ inputPer1M: 0.8, outputPer1M: 4 });
  });

  it("handles versioned haiku", () => {
    const p = getModelPricing("claude-3-5-haiku-20241022");
    expect(p).toEqual({ inputPer1M: 0.8, outputPer1M: 4 });
  });

  it("returns null for unknown models", () => {
    expect(getModelPricing("gpt-4o")).toBeNull();
  });

  it("handles gemini models", () => {
    expect(getModelPricing("gemini-2.5-pro")).toEqual({ inputPer1M: 1.25, outputPer1M: 10 });
    expect(getModelPricing("gemini-2.5-flash")).toEqual({ inputPer1M: 0.15, outputPer1M: 0.6 });
  });

  it("fuzzy matches versioned strings", () => {
    // "claude-opus-4-0620-extended" should match "claude-opus-4-0620"
    const p = getModelPricing("claude-opus-4-0620");
    expect(p).not.toBeNull();
    expect(p!.inputPer1M).toBe(15);
  });
});

describe("getModelDisplayName", () => {
  it("returns Opus 4 for opus models", () => {
    expect(getModelDisplayName("anthropic/claude-opus-4-0620")).toBe("Opus 4");
  });

  it("returns Sonnet 4 for sonnet-4 models", () => {
    expect(getModelDisplayName("claude-sonnet-4-0514")).toBe("Sonnet 4");
  });

  it("returns Sonnet 3.5 for older sonnet", () => {
    expect(getModelDisplayName("claude-3-5-sonnet-20241022")).toBe("Sonnet 3.5");
  });

  it("returns Haiku 3.5", () => {
    expect(getModelDisplayName("claude-3-5-haiku-20241022")).toBe("Haiku 3.5");
  });

  it("returns Haiku 3 for old haiku", () => {
    expect(getModelDisplayName("claude-3-haiku-20240307")).toBe("Haiku 3");
  });

  it("returns normalized string for unknown models", () => {
    expect(getModelDisplayName("openai/gpt-4o")).toBe("gpt-4o");
  });
});
