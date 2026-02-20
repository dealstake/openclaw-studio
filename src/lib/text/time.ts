/**
 * Format a duration in milliseconds as a human-readable string.
 * Examples: "450ms", "3.2s", "2m 15s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

/**
 * Format a duration compactly (e.g. "1.2m", "3.5s").
 * Accepts undefined for convenience — returns "—".
 */
export function formatDurationCompact(ms: number | undefined): string {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

/**
 * Format elapsed time between two timestamps as "Xs" or "Xm XXs".
 * Returns null if timestamps are missing or if `streaming` is true.
 */
export function formatElapsedLabel(
  startMs: number | undefined,
  completedMs: number | undefined,
  streaming?: boolean,
): string | null {
  if (streaming) return null;
  if (startMs != null && completedMs != null) {
    const secs = Math.max(0, Math.round((completedMs - startMs) / 1000));
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}m ${String(rem).padStart(2, "0")}s`;
  }
  return null;
}

/**
 * Format a timestamp as a human-readable relative time string.
 * Handles both past ("5m ago") and future ("in 5m") timestamps.
 */
export const formatRelativeTime = (timestamp: number | null | undefined): string => {
  if (!timestamp) return "—";
  const elapsed = Date.now() - timestamp;

  // Future timestamps
  if (elapsed < 0) {
    const remaining = -elapsed;
    const seconds = Math.floor(remaining / 1000);
    if (seconds < 10) return "now";
    if (seconds < 60) return `in ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  }

  // Past timestamps
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};
