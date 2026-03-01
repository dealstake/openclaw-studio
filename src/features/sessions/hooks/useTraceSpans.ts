import { useCallback, useRef, useState } from "react";

import type { TraceSpan, TraceSpansSummary, TraceSpansResult } from "../lib/spanTypes";

// ─── Fetch helper ──────────────────────────────────────────────────────────

async function fetchSpans(
  agentId: string,
  sessionId: string,
  turnIndex?: number,
): Promise<TraceSpansResult> {
  const params = new URLSearchParams({ agentId, sessionId });
  if (turnIndex !== undefined) params.set("turnIndex", String(turnIndex));
  const resp = await fetch(`/api/sessions/spans?${params}`);
  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    throw new Error(body?.error ?? `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<TraceSpansResult>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * Fetch and cache derived span data for a session.
 *
 * Usage:
 *   const { spans, summary, loading, error, load } = useTraceSpans(agentId, sessionId);
 *   useEffect(() => { load(); }, [load]);
 *
 * Optionally filter to a single turn:
 *   const { spans } = useTraceSpans(agentId, sessionId, { turnIndex: 3 });
 */
export function useTraceSpans(
  agentId: string | null,
  sessionId: string | null,
  options?: { turnIndex?: number },
) {
  const [spans, setSpans] = useState<TraceSpan[]>([]);
  const [summary, setSummary] = useState<TraceSpansSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!agentId || !sessionId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSpans(agentId, sessionId, options?.turnIndex);
      setSpans(result.spans);
      setSummary(result.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load spans";
      setError(message);
      console.error("[useTraceSpans]", message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [agentId, sessionId, options?.turnIndex]);

  return { spans, summary, loading, error, load };
}
