/**
 * Estimates API cost for a playground request/response pair.
 * Pricing sourced from public provider pages (USD per 1M tokens).
 */

interface ModelPricing {
  /** USD per 1M input tokens */
  inputPer1M: number;
  /** USD per 1M output tokens */
  outputPer1M: number;
}

// Prices as of 2026-02 — update as providers change rates
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "claude-opus-4-6":    { inputPer1M: 15,   outputPer1M: 75 },
  "claude-sonnet-4-6":  { inputPer1M: 3,    outputPer1M: 15 },
  "claude-sonnet-4-5":  { inputPer1M: 3,    outputPer1M: 15 },
  "claude-haiku-3.5":   { inputPer1M: 0.80, outputPer1M: 4 },
  "claude-haiku-3":     { inputPer1M: 0.25, outputPer1M: 1.25 },
  // Google Gemini
  "gemini-3.1-pro-preview": { inputPer1M: 1.25, outputPer1M: 10 },
  "gemini-3-pro-preview":   { inputPer1M: 1.25, outputPer1M: 10 },
  "gemini-2.5-pro":         { inputPer1M: 1.25, outputPer1M: 10 },
  "gemini-2.5-flash":       { inputPer1M: 0.15, outputPer1M: 0.60 },
  "gemini-2.0-flash":       { inputPer1M: 0.10, outputPer1M: 0.40 },
  "gemini-2.0-flash-lite":  { inputPer1M: 0.075, outputPer1M: 0.30 },
  "gemini-1.5-pro":         { inputPer1M: 1.25, outputPer1M: 5 },
  "gemini-1.5-flash":       { inputPer1M: 0.075, outputPer1M: 0.30 },
  // OpenAI
  "gpt-4o":             { inputPer1M: 2.5,  outputPer1M: 10 },
  "gpt-4o-mini":        { inputPer1M: 0.15, outputPer1M: 0.60 },
  "o3":                 { inputPer1M: 10,   outputPer1M: 40 },
  "o3-mini":            { inputPer1M: 1.10, outputPer1M: 4.40 },
};

/**
 * Extracts just the model ID from a `provider/model-id` key.
 */
function resolveModelId(modelKey: string): string {
  const parts = modelKey.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : modelKey;
}

/**
 * Returns pricing for a model key, or null if unknown.
 */
export function getPricing(modelKey: string): ModelPricing | null {
  const id = resolveModelId(modelKey);
  return MODEL_PRICING[id] ?? MODEL_PRICING[modelKey] ?? null;
}

/**
 * Estimates cost in USD for a given model + token counts.
 * Returns null if the model is unknown.
 */
export function estimateCostUsd(
  modelKey: string,
  tokensIn: number,
  tokensOut: number
): number | null {
  const pricing = getPricing(modelKey);
  if (!pricing) return null;
  return (tokensIn / 1_000_000) * pricing.inputPer1M +
         (tokensOut / 1_000_000) * pricing.outputPer1M;
}

/**
 * Formats a cost in USD to a human-readable string.
 * Very small values use sub-cent notation.
 */
export function formatCostUsd(usd: number): string {
  if (usd < 0.000_01) return "<$0.00001";
  if (usd < 0.001) return `$${usd.toFixed(5)}`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}
