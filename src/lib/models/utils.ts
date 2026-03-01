/**
 * Centralized model display name formatting.
 *
 * Internal values remain "provider/id" (e.g. "anthropic/claude-opus-4-6").
 * This is purely a DISPLAY utility.
 */

/** Known model family display names */
const MODEL_FAMILIES: [pattern: string, label: string][] = [
  ["opus", "Opus"],
  ["sonnet", "Sonnet"],
  ["haiku", "Haiku"],
  ["gemini", "Gemini"],
  ["gpt-4o", "GPT-4o"],
  ["gpt-4", "GPT-4"],
  ["gpt-3.5", "GPT-3.5"],
];

/**
 * Extract a human-friendly version string from a model id.
 * "claude-opus-4-6" → "4.6", "claude-haiku-3.5" → "3.5"
 */
function extractVersion(id: string): string {
  // Match trailing version like "4-6", "3.5", "3-5"
  const m = id.match(/(\d+)[.-](\d+)$/);
  if (m) return `${m[1]}.${m[2]}`;
  // Single trailing number
  const s = id.match(/(\d+)$/);
  return s ? s[1] : "";
}

/**
 * Format a model identifier for display.
 *
 * @example
 * formatModelDisplayName("anthropic/claude-opus-4-6")   // "Opus 4.6"
 * formatModelDisplayName("anthropic/claude-sonnet-4-5")  // "Sonnet 4.5"
 * formatModelDisplayName("claude-haiku-3.5")             // "Haiku 3.5"
 * formatModelDisplayName("openai/gpt-4o")                // "GPT-4o"
 */
export function formatModelDisplayName(modelId: string): string {
  if (!modelId) return "Model";

  // Strip provider prefix
  const id = modelId.includes("/") ? modelId.split("/").pop()! : modelId;

  // Match known families
  for (const [pattern, label] of MODEL_FAMILIES) {
    if (id.includes(pattern)) {
      const version = extractVersion(id);
      return version ? `${label} ${version}` : label;
    }
  }

  // Fallback: capitalize the id
  return id
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a short model name (alias for formatModelDisplayName).
 * @deprecated Use formatModelDisplayName directly.
 */
export const formatModelShort = formatModelDisplayName;
