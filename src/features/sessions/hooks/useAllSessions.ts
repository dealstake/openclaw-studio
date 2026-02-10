import { useCallback, useRef, useState } from "react";
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
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

export type AggregateTokensFromList = {
  inputTokens: number;
  outputTokens: number;
};

export const useAllSessions = (client: GatewayClient, status: GatewayStatus) => {
  const [allSessions, setAllSessions] = useState<SessionEntry[]>([]);
  const [allSessionsLoading, setAllSessionsLoading] = useState(false);
  const [allSessionsError, setAllSessionsError] = useState<string | null>(null);
  const [totalSessionCount, setTotalSessionCount] = useState(0);
  const [aggregateTokensFromList, setAggregateTokensFromList] = useState<AggregateTokensFromList | null>(null);

  const loadingRef = useRef(false);

  const loadAllSessions = useCallback(async () => {
    if (status !== "connected" || loadingRef.current) return;
    loadingRef.current = true;
    setAllSessionsLoading(true);
    try {
      const result = await client.call<SessionsListResult>("sessions.list", {
        includeGlobal: true,
        includeUnknown: true,
        limit: 200,
      });
      const rawEntries = result.sessions ?? [];
      const entries: SessionEntry[] = rawEntries.map((s) => ({
        key: s.key,
        updatedAt: s.updatedAt ?? null,
        displayName: s.displayName,
        origin: s.origin ?? null,
      }));
      setAllSessions(entries);
      setTotalSessionCount(entries.length);
      setAllSessionsError(null);

      // Compute aggregate token counts from list data
      const totalInput = rawEntries.reduce((sum, e) => sum + (e.inputTokens ?? 0), 0);
      const totalOutput = rawEntries.reduce((sum, e) => sum + (e.outputTokens ?? 0), 0);
      if (totalInput > 0 || totalOutput > 0) {
        setAggregateTokensFromList({ inputTokens: totalInput, outputTokens: totalOutput });
      } else {
        setAggregateTokensFromList(null);
      }
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        const message = err instanceof Error ? err.message : "Failed to load sessions.";
        setAllSessionsError(message);
      }
    } finally {
      loadingRef.current = false;
      setAllSessionsLoading(false);
    }
  }, [client, status]);

  return {
    allSessions,
    allSessionsLoading,
    allSessionsError,
    totalSessionCount,
    aggregateTokensFromList,
    loadAllSessions,
  };
};
