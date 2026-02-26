import { useCallback, useMemo, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";

export type SessionHistoryEntry = {
  key: string;
  displayName: string;
  updatedAt: number;
  messageCount: number;
  isMain: boolean;
  /** First-message preview (truncated to 60 chars) */
  summary?: string;
};

export type SessionHistoryGroup = {
  label: string;
  sessions: SessionHistoryEntry[];
};

import type { SessionsListResult } from "@/features/sessions/lib/types";
import type { TranscriptEntry } from "./useTranscripts";

// --- Pin storage (localStorage) ---

const PIN_STORAGE_KEY = "studio:pinned-sessions";

function loadPinnedKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function savePinnedKeys(keys: Set<string>): void {
  try {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Ignore storage errors
  }
}

// --- Grouping ---

function groupByDate(sessions: SessionHistoryEntry[], pinnedKeys: Set<string>): SessionHistoryGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;

  const pinned: SessionHistoryEntry[] = [];
  const today: SessionHistoryEntry[] = [];
  const yesterday: SessionHistoryEntry[] = [];
  const older: SessionHistoryEntry[] = [];

  for (const s of sessions) {
    if (pinnedKeys.has(s.key)) {
      pinned.push(s);
    } else if (s.updatedAt >= todayStart) {
      today.push(s);
    } else if (s.updatedAt >= yesterdayStart) {
      yesterday.push(s);
    } else {
      older.push(s);
    }
  }

  const groups: SessionHistoryGroup[] = [];
  if (pinned.length) groups.push({ label: "Pinned", sessions: pinned });
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
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(() => loadPinnedKeys());
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
      const mainKey = `agent:${agentId}:main`;
      const agentPrefix = `agent:${agentId}:`;
      const agentSessions = raw
        .filter((s) => {
          const key = s.key;
          return key.startsWith(agentPrefix);
        })
        .filter((s) => {
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

      // Fetch previews from transcripts API and merge as summaries
      try {
        const params = new URLSearchParams({ agentId, page: "1", perPage: "200" });
        const resp = await fetch(`/api/sessions/transcripts?${params}`);
        if (resp.ok) {
          const data = await resp.json();
          const transcripts: TranscriptEntry[] = data.transcripts ?? [];
          const previewMap = new Map<string, string>();
          for (const t of transcripts) {
            if (t.sessionKey && t.preview) {
              previewMap.set(t.sessionKey, t.preview.length > 60 ? t.preview.slice(0, 57) + "…" : t.preview);
            }
          }
          if (previewMap.size > 0) {
            setSessions(prev => prev.map(s => {
              const preview = previewMap.get(s.key);
              return preview ? { ...s, summary: preview } : s;
            }));
          }
        }
      } catch {
        // Non-critical — previews are a nice-to-have enhancement
      }
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [client, status, agentId]);

  const togglePin = useCallback((key: string) => {
    setPinnedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      savePinnedKeys(next);
      return next;
    });
  }, []);

  const deleteSession = useCallback(async (key: string) => {
    try {
      await client.call("sessions.delete", { key });
      setSessions((prev) => prev.filter((s) => s.key !== key));
      // Also remove from pins if pinned
      setPinnedKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        savePinnedKeys(next);
        return next;
      });
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }, [client]);

  const renameSession = useCallback(async (key: string, newName: string) => {
    try {
      await client.call("sessions.update", { key, displayName: newName });
      setSessions((prev) =>
        prev.map((s) => (s.key === key ? { ...s, displayName: newName } : s))
      );
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
  }, [client]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.displayName.toLowerCase().includes(q));
  }, [sessions, search]);

  const groups = useMemo(() => groupByDate(filtered, pinnedKeys), [filtered, pinnedKeys]);

  return {
    sessions: filtered,
    groups,
    loading,
    error,
    load,
    search,
    setSearch,
    pinnedKeys,
    togglePin,
    deleteSession,
    renameSession,
    totalFiltered: filtered.length,
    totalCount: sessions.length,
  };
}
