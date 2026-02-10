import { useCallback, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { SessionEntry } from "@/features/sessions/components/SessionsPanel";

type SessionsListEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null; provider?: string | null } | null;
  thinkingLevel?: string;
  modelProvider?: string;
  model?: string;
};

type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

export const useAllSessions = (client: GatewayClient, status: GatewayStatus) => {
  const [allSessions, setAllSessions] = useState<SessionEntry[]>([]);
  const [allSessionsLoading, setAllSessionsLoading] = useState(false);
  const [allSessionsError, setAllSessionsError] = useState<string | null>(null);
  const [totalSessionCount, setTotalSessionCount] = useState(0);

  const loadAllSessions = useCallback(async () => {
    if (status !== "connected") return;
    setAllSessionsLoading(true);
    try {
      const result = await client.call<SessionsListResult>("sessions.list", {
        includeGlobal: true,
        includeUnknown: true,
        limit: 2000,
      });
      const entries: SessionEntry[] = (result.sessions ?? []).map((s) => ({
        key: s.key,
        updatedAt: s.updatedAt ?? null,
        displayName: s.displayName,
        origin: s.origin ?? null,
      }));
      setAllSessions(entries);
      setTotalSessionCount(entries.length);
      setAllSessionsError(null);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message = err instanceof Error ? err.message : "Failed to load sessions.";
        setAllSessionsError(message);
      }
    } finally {
      setAllSessionsLoading(false);
    }
  }, [client, status]);

  return {
    allSessions,
    allSessionsLoading,
    allSessionsError,
    totalSessionCount,
    loadAllSessions,
  };
};
