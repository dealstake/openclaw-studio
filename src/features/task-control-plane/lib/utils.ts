/**
 * Extracted utility functions for the task-control-plane feature.
 * Pure functions — no React imports.
 */

export const readString = (record: Record<string, unknown> | null, keys: string[]): string | null => {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

export const readNumber = (record: Record<string, unknown> | null, keys: string[]): number | null => {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
};

export const readObjectArray = (
  record: Record<string, unknown> | null,
  keys: string[],
): Record<string, unknown>[] => {
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;
    return value.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    );
  }
  return [];
};

export const getDescriptionPreview = (value: string): string => {
  const firstLine =
    value
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  if (!firstLine) return "";
  if (firstLine.length <= 140) return firstLine;
  return `${firstLine.slice(0, 140)}...`;
};

export const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const formatTimestampOrFallback = (value: string | null, fallback = "Unknown"): string => {
  if (!value) return fallback;
  return formatTimestamp(value);
};

/** Priority level metadata for the task control plane. */
export const PRIORITY_LEVELS = [
  { value: 0, label: "Critical" },
  { value: 1, label: "High" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Low" },
  { value: 4, label: "Backlog" },
] as const;
