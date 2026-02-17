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
