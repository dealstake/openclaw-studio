import { useCallback, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { SessionEntry } from "@/features/sessions/components/SessionsPanel";
import { inferSessionType } from "@/features/sessions/lib/sessionKeyUtils";

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

export type UsageByType = {
  main: number;
  cron: number;
  subagent: number;
  channel: number;
  unknown: number;
};

export const useAllSessions = (client: GatewayClient, status: GatewayStatus) => {
  const [allSessions, setAllSessions] = useState<SessionEntry[]>([]);
  const [allSessionsLoading, setAllSessionsLoading] = useState(false);
  const [allSessionsError, setAllSessionsError] = useState<string | null>(null);
  const [totalSessionCount, setTotalSessionCount] = useState(0);
  const [aggregateUsageFromList, setAggregateUsageFromList] = useState<AggregateUsageFromList | null>(null);
  const [usageByType, setUsageByType] = useState<UsageByType | null>(null);

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

      // Compute aggregate token counts from list data.
      // sessions.list returns totalTokens (combined) but not separate input/output or messageCount.
      // Use totalTokens as fallback when input/output aren't provided.
      const totalInput = rawEntries.reduce((sum, e) => sum + (e.inputTokens ?? 0), 0);
      const totalOutput = rawEntries.reduce((sum, e) => sum + (e.outputTokens ?? 0), 0);
      const totalFromCombined = rawEntries.reduce((sum, e) => sum + (e.totalTokens ?? 0), 0);
      const effectiveInput = totalInput > 0 ? totalInput : totalFromCombined;
      const effectiveOutput = totalInput > 0 ? totalOutput : 0;
      const totalMessages = rawEntries.reduce((sum, e) => sum + (e.messageCount ?? 0), 0);
      
      // Note: sessions.list doesn't typically return cost, so we default to null
      // unless we want to estimate it client-side. For now, leave as null.
      
      if (effectiveInput > 0 || effectiveOutput > 0 || totalMessages > 0) {
        setAggregateUsageFromList({ 
          inputTokens: effectiveInput, 
          outputTokens: effectiveOutput,
          messageCount: totalMessages,
          totalCost: null
        });
      } else {
        setAggregateUsageFromList(null);
      }

      // Compute token breakdown by session type
      const byType: UsageByType = { main: 0, cron: 0, subagent: 0, channel: 0, unknown: 0 };
      for (const e of rawEntries) {
        const type = inferSessionType(e.key);
        const tokens = (e.inputTokens ?? 0) + (e.outputTokens ?? 0) || (e.totalTokens ?? 0);
        byType[type] += tokens;
      }
      const hasAny = byType.main + byType.cron + byType.subagent + byType.channel + byType.unknown > 0;
      setUsageByType(hasAny ? byType : null);
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
    usageByType,
    loadAllSessions,
  };
};
