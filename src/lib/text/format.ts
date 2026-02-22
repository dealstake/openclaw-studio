/**
 * Format a monetary cost for display.
 */
export function formatCost(cost: number, currency: string = "USD"): string {
  if (cost < 0.01) {
    return `<$0.01`;
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cost);
}

/**
 * Format a monetary cost, returning empty string for zero values.
 * Useful in tables/rows where zero should be blank.
 */
export function formatCostOrEmpty(cost: number, currency: string = "USD"): string {
  if (cost === 0) return "";
  return formatCost(cost, currency);
}

/**
 * Format a token count with K/M suffixes.
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Format a token count, returning empty string for zero values.
 */
export function formatTokensOrEmpty(n: number): string {
  if (n === 0) return "";
  return formatTokens(n);
}

/**
 * Format a byte count as a human-readable size string.
 */
export const formatSize = (bytes: number | undefined): string => {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Format a byte count from a string (e.g. from API responses).
 */
export const formatSizeFromString = (bytes?: string): string => {
  if (!bytes) return "—";
  const b = parseInt(bytes, 10);
  if (isNaN(b)) return "—";
  return formatSize(b) || "—";
};
