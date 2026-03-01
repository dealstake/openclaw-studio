import { useCallback, useRef, useState } from "react";

import type {
  EnhancedTranscriptMessage,
  TraceSummary,
  TraceTurn,
} from "@/features/sessions/lib/traceParser";
import { parseTrace } from "@/features/sessions/lib/traceParser";

type TraceResponse = {
  sessionId: string;
  messages: EnhancedTranscriptMessage[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

async function fetchTrace(
  agentId: string,
  sessionId: string,
  offset = 0,
  limit = 500,
): Promise<TraceResponse> {
  const params = new URLSearchParams({
    agentId,
    sessionId,
    offset: String(offset),
    limit: String(limit),
  });
  const resp = await fetch(`/api/sessions/trace?${params}`);
  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    throw new Error(body?.error ?? `HTTP ${resp.status}`);
  }
  return resp.json();
}

export function useSessionTrace(agentId: string | null, sessionId: string | null) {
  const [turns, setTurns] = useState<TraceTurn[]>([]);
  const [summary, setSummary] = useState<TraceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!agentId || !sessionId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Paginate until hasMore is false — sessions with >500 messages were silently truncated
      const PAGE_SIZE = 500;
      const allMessages: import("@/features/sessions/lib/traceParser").EnhancedTranscriptMessage[] =
        [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const page = await fetchTrace(agentId, sessionId, offset, PAGE_SIZE);
        allMessages.push(...page.messages);
        hasMore = page.hasMore;
        offset += page.messages.length;
        // Safety: if the API returns 0 messages, stop to avoid an infinite loop
        if (page.messages.length === 0) break;
      }
      const result = parseTrace(allMessages, sessionId);
      setTurns(result.turns);
      setSummary(result.summary);
      if (result.turns.length > 0) {
        setSelectedTurnIndex((prev) => prev ?? 0);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load trace";
      setError(message);
      console.error("[useSessionTrace]", message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [agentId, sessionId]);

  return {
    turns,
    summary,
    loading,
    error,
    selectedTurnIndex,
    setSelectedTurnIndex,
    load,
  };
}
