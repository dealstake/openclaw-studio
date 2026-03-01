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
            : s.key.slice(agentPrefix.length) || s.key),
        updatedAt: s.updatedAt ?? 0,
        messageCount: s.messageCount ?? 0,
        isMain: s.key === mainKey,
      }),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
