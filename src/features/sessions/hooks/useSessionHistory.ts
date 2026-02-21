import { useCallback, useMemo, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";

export type SessionHistoryEntry = {
  key: string;
  displayName: string;
  updatedAt: number;
  messageCount: number;
  isMain: boolean;
};

export type SessionHistoryGroup = {
  label: string;
  sessions: SessionHistoryEntry[];
};

type SessionsListEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null; provider?: string | null } | null;
  messageCount?: number;
};

type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

function groupByDate(sessions: SessionHistoryEntry[]): SessionHistoryGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;

  const today: SessionHistoryEntry[] = [];
  const yesterday: SessionHistoryEntry[] = [];
  const older: SessionHistoryEntry[] = [];

  for (const s of sessions) {
    if (s.updatedAt >= todayStart) today.push(s);
    else if (s.updatedAt >= yesterdayStart) yesterday.push(s);
    else older.push(s);
  }

  const groups: SessionHistoryGroup[] = [];
  if (today.length) groups.push({ label: "Today", sessions: today });
  if (yesterday.length) groups.push({ label: "Yesterday", sessions: yesterday });
  if (older.length) groups.push({ label: "Older", sessions: older });
  return groups;
}

export function useSessionHistory(client: GatewayClient, status: GatewayStatus, agentId: string | null) {
  const [sessions, setSessions] = useState<SessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (status !== "connected" || !agentId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await client.call<SessionsListResult>("sessions.list", {
        includeGlobal: true,
        limit: 200,
      });
      const raw = result.sessions ?? [];
      // Filter to sessions belonging to this agent (key starts with agentId/ or is agentId:main)
      // Session keys use "agent:<agentId>:<sessionId>" format (e.g. "agent:alex:main")
      const mainKey = `agent:${agentId}:main`;
      const agentPrefix = `agent:${agentId}:`;
      const agentSessions = raw
        .filter((s) => {
          const key = s.key;
          return key.startsWith(agentPrefix);
        })
        .filter((s) => {
          // Exclude cron/subagent sessions — only show user-initiated sessions
          const key = s.key;
          return !key.includes(":cron:") && !key.includes(":sub:");
        })
        .map((s): SessionHistoryEntry => ({
          key: s.key,
          displayName: s.displayName || (s.key === mainKey ? "Main Session" : s.key.slice(agentPrefix.length) || s.key),
          updatedAt: s.updatedAt ?? 0,
          messageCount: s.messageCount ?? 0,
          isMain: s.key === mainKey,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);

      setSessions(agentSessions);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [client, status, agentId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.displayName.toLowerCase().includes(q));
  }, [sessions, search]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  return { sessions: filtered, groups, loading, error, load, search, setSearch };
}
