/**
 * Shared utility for filtering raw session list results to only
 * user-facing agent sessions (excludes cron and sub-agent sessions).
 */

import type { SessionHistoryEntry } from "../hooks/useSessionHistory";

type RawSession = {
  key: string;
  displayName?: string;
  updatedAt?: number | null;
  messageCount?: number | null;
};

/**
 * Convert raw session key suffixes into human-readable names.
 * e.g. "wizard:persona:mm9r0j3rd..." → "Persona Wizard"
 *      "practice:trident-support"    → "Practice: Trident Support"
 */
function prettifySessionKey(suffix: string): string {
  // wizard:TYPE:ID → "Type Wizard"
  const wizardMatch = suffix.match(/^wizard:(\w+)(?::|$)/);
  if (wizardMatch) {
    const type = wizardMatch[1];
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    return `${label} Wizard`;
  }

  // practice:SLUG → "Practice: Slug Name"
  const practiceMatch = suffix.match(/^practice:(.+)/);
  if (practiceMatch) {
    const slug = practiceMatch[1]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `Practice: ${slug}`;
  }

  // subagent:LABEL → "Sub-agent: Label"
  const subagentMatch = suffix.match(/^subagent:(.+)/);
  if (subagentMatch) {
    const label = subagentMatch[1]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `Sub-agent: ${label}`;
  }

  // Fallback: humanize kebab/snake → Title Case, truncate long IDs
  const humanized = suffix
    .replace(/[-_:]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  // If result looks like a random ID (e.g. "Mm9r0j3rd..."), just show "Session"
  if (/^[A-Za-z0-9]{8,}$/.test(humanized.replace(/\s/g, ""))) {
    return "Session";
  }

  return humanized || "Session";
}

/**
 * Filters raw sessions to agent-scoped, user-facing sessions (no cron/sub),
 * maps to SessionHistoryEntry, and sorts by updatedAt descending.
 */
export function filterAgentSessions(
  raw: RawSession[],
  agentId: string,
): SessionHistoryEntry[] {
  const mainKey = `agent:${agentId}:main`;
  const agentPrefix = `agent:${agentId}:`;

  return raw
    .filter((s) => s.key.startsWith(agentPrefix))
    .filter((s) => !s.key.includes(":cron:") && !s.key.includes(":sub:"))
    .map(
      (s): SessionHistoryEntry => ({
        key: s.key,
        displayName:
          s.displayName ||
          (s.key === mainKey
            ? "Main Session"
            : prettifySessionKey(s.key.slice(agentPrefix.length))),
        updatedAt: s.updatedAt ?? Date.now(),
        messageCount: s.messageCount ?? 0,
        isMain: s.key === mainKey,
      }),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
