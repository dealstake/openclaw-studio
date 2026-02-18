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
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};
