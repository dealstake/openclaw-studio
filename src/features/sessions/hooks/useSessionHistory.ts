import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** Session UUID (for archived sessions that use synthetic keys) */
  sessionId?: string;
  /** Whether this session was archived via reset or deletion */
  archiveType?: "reset" | "deleted" | null;
  /** When the session was archived (ISO string) */
  archivedAt?: string | null;
};

export type SessionHistoryGroup = {
  label: string;
  sessions: SessionHistoryEntry[];
};

import type { SessionsListResult } from "@/features/sessions/lib/types";
import type { TranscriptEntry } from "./useTranscripts";
import { filterAgentSessions } from "../lib/filterAgentSessions";

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

function groupByDate(
  sessions: SessionHistoryEntry[],
  pinnedKeys: Set<string>,
  activeSessionKey?: string | null,
): SessionHistoryGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;

  const current: SessionHistoryEntry[] = [];
  const pinned: SessionHistoryEntry[] = [];
  const today: SessionHistoryEntry[] = [];
  const yesterday: SessionHistoryEntry[] = [];
  const older: SessionHistoryEntry[] = [];
  const archived: SessionHistoryEntry[] = [];

  for (const s of sessions) {
    // Archived sessions go to their own group
    if (s.archiveType) {
      archived.push(s);
    // Active/current session always pinned to very top
    } else if (activeSessionKey && s.key === activeSessionKey) {
      current.push(s);
    } else if (pinnedKeys.has(s.key)) {
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
  if (current.length) groups.push({ label: "Current", sessions: current });
  if (pinned.length) groups.push({ label: "Pinned", sessions: pinned });
  if (today.length) groups.push({ label: "Today", sessions: today });
  if (yesterday.length) groups.push({ label: "Yesterday", sessions: yesterday });
  if (older.length) groups.push({ label: "Older", sessions: older });
  if (archived.length) groups.push({ label: "Archived", sessions: archived });
  return groups;
}

export function useSessionHistory(
  client: GatewayClient,
  status: GatewayStatus,
  agentId: string | null,
  activeSessionKey?: string | null,
) {
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
      // Fetch sessions list and transcript data concurrently
      const params = new URLSearchParams({ agentId, page: "1", perPage: "500" });
      const [sessionsResult, transcriptData] = await Promise.all([
        client.call<SessionsListResult>("sessions.list", {
          includeGlobal: true,
          limit: 200,
        }),
        fetch(`/api/sessions/transcripts?${params}`)
          .then(async (resp) => {
            if (!resp.ok) return { transcripts: [] as TranscriptEntry[], previewMap: new Map<string, string>() };
            const data = await resp.json();
            const transcripts: TranscriptEntry[] = data.transcripts ?? [];
            const previewMap = new Map<string, string>();
            for (const t of transcripts) {
              if (t.sessionKey && t.preview) {
                previewMap.set(
                  t.sessionKey,
                  t.preview.length > 60 ? t.preview.slice(0, 57) + "…" : t.preview,
                );
              }
            }
            return { transcripts, previewMap };
          })
          .catch(() => ({ transcripts: [] as TranscriptEntry[], previewMap: new Map<string, string>() })),
      ]);

      const raw = sessionsResult.sessions ?? [];
      const agentSessions = filterAgentSessions(raw, agentId);
      const { transcripts, previewMap } = transcriptData;

      // Merge previews into active sessions
      const sessionsWithPreviews = previewMap.size > 0
        ? agentSessions.map((s) => {
            const preview = previewMap.get(s.key);
            return preview ? { ...s, summary: preview } : s;
          })
        : agentSessions;

      // Build set of active session UUIDs to detect orphaned archived transcripts
      const activeSessionIds = new Set<string>();
      for (const t of transcripts) {
        if (!t.archived && !t.archiveType) activeSessionIds.add(t.sessionId);
      }

      // Create synthetic entries for archived transcripts not already in active list
      const agentPrefix = `agent:${agentId}:`;
      const archivedEntries: SessionHistoryEntry[] = transcripts
        .filter((t) => {
          if (!t.archiveType) return false; // only reset/deleted
          // Only show archived sessions for this agent
          if (t.sessionKey && !t.sessionKey.startsWith(agentPrefix)) return false;
          // Filter out cron and sub-agent sessions
          if (t.sessionKey && (t.sessionKey.includes(":cron:") || t.sessionKey.includes(":sub:"))) return false;
          return true;
        })
        .map((t): SessionHistoryEntry => {
          const syntheticKey = `archived:${t.sessionId}`;
          let displayName: string;
          if (t.sessionKey) {
            const keyPart = t.sessionKey.startsWith(agentPrefix)
              ? t.sessionKey.slice(agentPrefix.length)
              : t.sessionKey;
            const label = keyPart === "main" ? "Main Session" : keyPart;
            const typeLabel = t.archiveType === "reset" ? "Reset" : "Deleted";
            displayName = `${label} · ${typeLabel}`;
          } else {
            displayName = `Session · ${t.archiveType === "reset" ? "Reset" : "Deleted"}`;
          }
          const updatedAt = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
          return {
            key: syntheticKey,
            displayName,
            updatedAt,
            messageCount: 0,
            isMain: false,
            summary: t.preview
              ? t.preview.length > 60 ? t.preview.slice(0, 57) + "…" : t.preview
              : undefined,
            sessionId: t.sessionId,
            archiveType: t.archiveType,
            archivedAt: t.archivedAt,
          };
        });

      // Combine active + archived, sort by updatedAt descending
      const allSessions = [...sessionsWithPreviews, ...archivedEntries]
        .sort((a, b) => b.updatedAt - a.updatedAt);

      setSessions(allSessions);
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

  // Auto-refresh every 30s for cross-tab freshness
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (status !== "connected") return;
    const id = window.setInterval(() => { void loadRef.current(); }, 30_000);
    return () => window.clearInterval(id);
  }, [status]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.displayName.toLowerCase().includes(q));
  }, [sessions, search]);

  const groups = useMemo(
    () => groupByDate(filtered, pinnedKeys, activeSessionKey),
    [filtered, pinnedKeys, activeSessionKey],
  );

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
