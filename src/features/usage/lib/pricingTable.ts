/**
 * Static model pricing table for client-side cost estimation.
 * Prices in USD per 1M tokens. Update as Anthropic adjusts pricing.
 */

export type ModelPricing = {
  inputPer1M: number;
  outputPer1M: number;
};

/**
 * Known model pricing. Keys are normalized model identifiers.
 * Includes common aliases and versioned variants.
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Opus 4
  "claude-opus-4-0620": { inputPer1M: 15, outputPer1M: 75 },
  "claude-opus-4": { inputPer1M: 15, outputPer1M: 75 },
  // Sonnet 4
  "claude-sonnet-4-0514": { inputPer1M: 3, outputPer1M: 15 },
  "claude-sonnet-4": { inputPer1M: 3, outputPer1M: 15 },
  // Sonnet 3.5
  "claude-sonnet-3.5": { inputPer1M: 3, outputPer1M: 15 },
  "claude-3-5-sonnet-20241022": { inputPer1M: 3, outputPer1M: 15 },
  // Haiku 3.5
  "claude-haiku-3.5": { inputPer1M: 0.8, outputPer1M: 4 },
  "claude-3-5-haiku-20241022": { inputPer1M: 0.8, outputPer1M: 4 },
  // Haiku 3
  "claude-3-haiku-20240307": { inputPer1M: 0.25, outputPer1M: 1.25 },
};

/**
 * Normalize a model string by stripping provider prefix (e.g. "anthropic/")
 * and attempting fuzzy matching against known models.
 */
function normalizeModelId(model: string): string {
  // Strip provider prefix
  const stripped = model.includes("/") ? model.split("/").pop()! : model;
  return stripped.toLowerCase();
}

/**
 * Look up pricing for a model string. Handles provider prefixes
 * (e.g. "anthropic/claude-opus-4-0620") and version suffixes.
 * Returns null for unknown models.
 */
export function getModelPricing(model: string): ModelPricing | null {
  const normalized = normalizeModelId(model);

  // Direct match
  if (MODEL_PRICING[normalized]) {
    return MODEL_PRICING[normalized];
  }

  // Fuzzy: find a key that the normalized string starts with, or vice versa
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (normalized.startsWith(key) || key.startsWith(normalized)) {
      return pricing;
    }
  }

  return null;
}

/**
 * Get a short display name for a model string.
 */
export function getModelDisplayName(model: string): string {
  const normalized = normalizeModelId(model);
  if (normalized.includes("opus")) return "Opus 4";
  if (normalized.includes("sonnet-4") || normalized.includes("sonnet-4")) return "Sonnet 4";
  if (normalized.includes("sonnet-3") || normalized.includes("sonnet-3.5")) return "Sonnet 3.5";
  if (normalized.includes("haiku-3.5") || normalized.includes("haiku-3-5")) return "Haiku 3.5";
  if (normalized.includes("haiku")) return "Haiku 3";
  return normalized;
}
