/**
 * Pure utility functions for transcript display logic.
 * Extracted from SessionsPanel for testability and reuse.
 */
import type { TranscriptEntry } from "../hooks/useTranscripts";
import { CHANNEL_TYPE_LABELS } from "./sessionKeyUtils";

export type TranscriptType = "main" | "cron" | "subagent" | "channel" | "unknown";

const CHANNEL_TYPES = Object.keys(CHANNEL_TYPE_LABELS);

/**
 * Infer the type of a transcript from its sessionKey or preview content.
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
  const lower = key.toLowerCase();
  if (/:main$/i.test(key) || lower.endsWith("-main")) return "main";
  if (/:cron:/i.test(key) || /^cron:/i.test(key) || lower.includes(":cron:") || lower.includes("-cron-")) return "cron";
  if (/:subagent:/i.test(key) || lower.includes("-subagent")) return "subagent";
  for (const ch of CHANNEL_TYPES) {
    if (lower.startsWith(ch)) return "channel";
  }
  // Check for gateway agent key format: channel:G-AGENT-name-type
  const agentMatch = lower.match(/^([a-z]+):g-agent-[a-z0-9]+-(.+)$/);
  if (agentMatch) {
    const suffix = agentMatch[2];
    if (suffix === "main") return "main";
    if (suffix.startsWith("subagent")) return "subagent";
    if (suffix.startsWith("cron")) return "cron";
    // If channel prefix is known, it's a channel session
    if (CHANNEL_TYPE_LABELS[agentMatch[1]]) return "channel";
  }
  return "unknown";
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
export function splitByQuery(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  if (!query.trim()) return [{ text, match: false }];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      match: part.toLowerCase() === query.toLowerCase(),
    }));
}
