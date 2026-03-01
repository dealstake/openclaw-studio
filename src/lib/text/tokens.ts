/**
 * Token estimation utilities.
 * Uses the rough heuristic of ~4 bytes per token for UTF-8 English text (GPT-style BPE).
 * This is an estimate — actual counts depend on tokenizer and content.
 */

const BYTES_PER_TOKEN = 4;

/**
 * Estimate the number of tokens for a given byte count.
 * Returns 0 for non-positive inputs.
 */
export function estimateTokens(bytes: number): number {
  if (bytes <= 0) return 0;
  return Math.ceil(bytes / BYTES_PER_TOKEN);
}

/**
 * Format a token estimate for display (e.g. "~1.2K", "~340").
 */
export function formatTokenEstimate(tokens: number): string {
  if (tokens <= 0) return "0";
  if (tokens >= 1_000_000) return `~${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `~${(tokens / 1_000).toFixed(1)}K`;
  return `~${tokens}`;
}
