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
  messageCount?: number;
};

type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

export type AggregateUsageFromList = {
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
  totalCost: number | null;
};

export const useAllSessions = (client: GatewayClient, status: GatewayStatus) => {
  const [allSessions, setAllSessions] = useState<SessionEntry[]>([]);
  const [allSessionsLoading, setAllSessionsLoading] = useState(false);
  const [allSessionsError, setAllSessionsError] = useState<string | null>(null);
  const [totalSessionCount, setTotalSessionCount] = useState(0);
  const [aggregateUsageFromList, setAggregateUsageFromList] = useState<AggregateUsageFromList | null>(null);

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
      const totalMessages = rawEntries.reduce((sum, e) => sum + (e.messageCount ?? 0), 0);
      
      // Note: sessions.list doesn't typically return cost, so we default to null
      // unless we want to estimate it client-side. For now, leave as null.
      
      if (totalInput > 0 || totalOutput > 0 || totalMessages > 0) {
        setAggregateUsageFromList({ 
          inputTokens: totalInput, 
          outputTokens: totalOutput,
          messageCount: totalMessages,
          totalCost: null
        });
      } else {
        setAggregateUsageFromList(null);
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
    aggregateUsageFromList,
    loadAllSessions,
  };
};
