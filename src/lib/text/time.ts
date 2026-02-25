/**
 * Core time breakdown helper — shared by all formatting functions.
 */
interface TimeBreakdown {
  ms: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  /** Remaining seconds after extracting minutes */
  remainderSeconds: number;
  /** Remaining minutes after extracting hours */
  remainderMinutes: number;
  /** Remaining hours after extracting days */
  remainderHours: number;
}

export function breakDownMs(ms: number): TimeBreakdown {
  const clamped = Math.max(0, ms);
  const seconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return {
    ms: clamped,
    seconds,
    minutes,
    hours,
    days,
    remainderSeconds: seconds % 60,
    remainderMinutes: minutes % 60,
    remainderHours: hours % 24,
  };
}

/**
 * Format a duration in milliseconds as a human-readable string.
 * Examples: "450ms", "3.2s", "2m 15s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const { minutes, remainderSeconds } = breakDownMs(ms);
  return `${minutes}m ${remainderSeconds}s`;
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
    const { minutes, remainderSeconds } = breakDownMs(completedMs - startMs);
    const secs = minutes * 60 + remainderSeconds; // total seconds for < 60 check
    if (secs < 60) return `${secs}s`;
    return `${minutes}m ${String(remainderSeconds).padStart(2, "0")}s`;
  }
  return null;
}

/**
 * Format an uptime duration from a start timestamp.
 * Examples: "45s", "12m", "3h 25m", "2d 5h"
 */
export function formatUptime(startedAtMs: number): string {
  const { seconds, minutes, hours, days, remainderMinutes, remainderHours } = breakDownMs(
    Date.now() - startedAtMs,
  );
  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h ${remainderMinutes}m`;
  return `${days}d ${remainderHours}h`;
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
    const { seconds, minutes, hours, days } = breakDownMs(-elapsed);
    if (seconds < 10) return "now";
    if (seconds < 60) return `in ${seconds}s`;
    if (minutes < 60) return `in ${minutes}m`;
    if (hours < 24) return `in ${hours}h`;
    return `in ${days}d`;
  }

  // Past timestamps
  const { seconds, minutes, hours, days } = breakDownMs(elapsed);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};
