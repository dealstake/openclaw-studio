import { useCallback, useEffect, useRef, useState } from "react";

export type TranscriptEntry = {
  sessionId: string;
  sessionKey: string | null;
  archived: boolean;
  size: number;
  startedAt: string | null;
  updatedAt: string | null;
  model: string | null;
  preview: string | null;
};

type TranscriptMessage = {
  id: string;
  role: string;
  content: string | Array<{ type: string; text?: string }>;
  timestamp: string;
};

type TranscriptResponse = {
  sessionId: string;
  messages: TranscriptMessage[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

/**
 * Fetch the list of all session transcripts (active + archived) from the sidecar.
 */
export function useTranscripts(agentId: string | null) {
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRef = useRef<() => Promise<void>>(undefined);

  const load = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/sessions/transcripts?agentId=${encodeURIComponent(agentId)}`);
      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setTranscripts(data.transcripts ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load transcripts";
      setError(message);
      console.error("[useTranscripts]", message);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  loadRef.current = load;

  useEffect(() => {
    void loadRef.current?.();
  }, [agentId]);

  return { transcripts, loading, error, refresh: load };
}

/**
 * Fetch messages for a specific transcript from the sidecar.
 */
export async function fetchTranscriptMessages(
  agentId: string,
  sessionId: string,
  offset = 0,
  limit = 200
): Promise<TranscriptResponse> {
  const params = new URLSearchParams({
    agentId,
    sessionId,
    offset: String(offset),
    limit: String(limit),
  });
  const resp = await fetch(`/api/sessions/transcript?${params}`);
  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    throw new Error(body?.error ?? `HTTP ${resp.status}`);
  }
  return resp.json();
}
