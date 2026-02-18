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
      const data = await fetchTrace(agentId, sessionId);
      const result = parseTrace(data.messages, sessionId);
      setTurns(result.turns);
      setSummary(result.summary);
      if (result.turns.length > 0 && selectedTurnIndex === null) {
        setSelectedTurnIndex(0);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load trace";
      setError(message);
      console.error("[useSessionTrace]", message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [agentId, sessionId, selectedTurnIndex]);

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
