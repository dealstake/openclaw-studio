import { formatRelativeTime } from "@/lib/text/time";

import type { ActivityEvent, ActivityStatus, DisplayEvent } from "./activityTypes";

const compactNumber = new Intl.NumberFormat("en", { notation: "compact" });

/**
 * Transform a raw ActivityEvent into a display-ready DisplayEvent.
 */
export function formatActivityEvent(raw: ActivityEvent): DisplayEvent {
  const ts = new Date(raw.timestamp).getTime();

  let formattedTokens: string | null = null;
  const tokensIn = raw.meta?.tokensIn ?? 0;
  const tokensOut = raw.meta?.tokensOut ?? 0;
  const totalTokens = tokensIn + tokensOut;
  if (totalTokens > 0) {
    formattedTokens = compactNumber.format(totalTokens);
  }

  return {
    ...raw,
    relativeTime: formatRelativeTime(ts),
    statusColor: getStatusColor(raw.status),
    formattedTokens,
  };
}

/** Tailwind text color class for a given status */
export function getStatusColor(status: ActivityStatus): string {
  switch (status) {
    case "success":
      return "text-green-400";
    case "error":
      return "text-red-400";
    case "partial":
      return "text-yellow-400";
    default:
      return "text-muted-foreground";
  }
}

/** Tailwind background class for status indicator dot */
export function getStatusDotClass(status: ActivityStatus): string {
  switch (status) {
    case "success":
      return "bg-green-500";
    case "error":
      return "bg-red-500";
    case "partial":
      return "bg-yellow-500";
    default:
      return "bg-muted-foreground";
  }
}

/** Truncate text to maxLen, adding ellipsis if needed */
export function truncateSummary(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}
