/**
 * Shared timestamp parsing utilities.
 *
 * Extracted from historyUtils / summaryUtils / runtimeEventBridge
 * to eliminate 3× duplication (DRY).
 */

export const toTimestampMs = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

export const extractMessageTimestamp = (message: unknown): number | null => {
  if (!message || typeof message !== "object") return null;
  const record = message as Record<string, unknown>;
  return (
    toTimestampMs(record.timestamp) ?? toTimestampMs(record.createdAt) ?? toTimestampMs(record.at)
  );
};
