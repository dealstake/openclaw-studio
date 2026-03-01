/**
 * Pure utility functions for transcript display logic.
 * Extracted from SessionsPanel for testability and reuse.
 */
import type { TranscriptEntry } from "../hooks/useTranscripts";
import { CHANNEL_TYPE_LABELS, inferSessionType } from "./sessionKeyUtils";

export type TranscriptType = "main" | "cron" | "subagent" | "channel" | "unknown";

const CHANNEL_TYPES = Object.keys(CHANNEL_TYPE_LABELS);

/**
 * Infer the type of a transcript from its sessionKey or preview content.
 * Delegates key-based inference to inferSessionType from sessionKeyUtils,
 * with TranscriptEntry-specific fallbacks for entries without a sessionKey.
 */
export function inferTranscriptType(entry: TranscriptEntry): TranscriptType {
  const key = entry.sessionKey;
  if (!key) {
    // Fall back to sessionId-based inference (JSONL filenames often contain the key)
    const id = entry.sessionId?.toLowerCase() ?? "";
    if (id.includes("cron") || id.includes("heartbeat")) return "cron";
    if (id.includes("subagent") || id.includes("sub-agent")) return "subagent";
    if (id.includes("main")) return "main";
    for (const ch of CHANNEL_TYPES) {
      if (id.includes(ch)) return "channel";
    }
    // Fall back to preview content
    const preview = entry.preview?.toLowerCase() ?? "";
    if (preview.includes("cron") || preview.includes("heartbeat")) return "cron";
    if (preview.includes("sub-agent") || preview.includes("subagent")) return "subagent";
    return "unknown";
  }
  // Delegate key-based inference to the canonical implementation.
  // inferSessionType handles standard, gateway, and non-standard key formats.
  return inferSessionType(key);
}

export const TRANSCRIPT_TYPE_LABELS: Record<TranscriptType, string> = {
  main: "Main",
  cron: "Cron",
  subagent: "Sub-agent",
  channel: "Channel",
  unknown: "Other",
};

export const TRANSCRIPT_TYPE_COLORS: Record<TranscriptType, string> = {
  main: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  cron: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  subagent: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  channel: "border-purple-500/40 bg-purple-500/10 text-purple-400",
  unknown: "border-border/60 bg-muted/40 text-muted-foreground",
};

/**
 * Format a transcript entry into a human-readable display name.
 * Falls back to date/time or truncated sessionId.
 */
export function formatTranscriptDisplayName(
  entry: TranscriptEntry,
  humanizeSessionKey: (key: string) => string,
): string {
  if (entry.sessionKey) return humanizeSessionKey(entry.sessionKey);
  if (entry.startedAt) {
    const d = new Date(entry.startedAt);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    );
  }
  return entry.sessionId.slice(0, 12);
}

/**
 * Split text by query matches for highlighting. Returns array of { text, match } segments.
 */
const splitByQueryCache = new Map<string, RegExp>();

export function splitByQuery(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  if (!query.trim()) return [{ text, match: false }];
  let regex = splitByQueryCache.get(query);
  if (!regex) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(`(${escaped})`, "gi");
    splitByQueryCache.set(query, regex);
    // Prevent unbounded cache growth
    if (splitByQueryCache.size > 100) {
      const firstKey = splitByQueryCache.keys().next().value;
      if (firstKey !== undefined) splitByQueryCache.delete(firstKey);
    }
  }
  regex.lastIndex = 0;
  const parts = text.split(regex);
  const queryLower = query.toLowerCase();
  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      match: part.toLowerCase() === queryLower,
    }));
}
