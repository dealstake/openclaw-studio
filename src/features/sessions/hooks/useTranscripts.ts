import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type TranscriptSearchMatch = {
  role: string;
  timestamp: string | null;
  snippet: string;
};

export type TranscriptSearchResult = {
  sessionId: string;
  sessionKey: string | null;
  archived: boolean;
  startedAt: string | null;
  updatedAt: string | null;
  matches: TranscriptSearchMatch[];
};

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
 * Search across all session transcripts via sidecar.
 */
export function useTranscriptSearch(agentId: string | null) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TranscriptSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (!agentId || !q.trim()) {
        setResults([]);
        return;
      }
      // Abort previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          agentId,
          query: q.trim(),
          limit: "50",
        });
        const resp = await fetch(`/api/sessions/search?${params}`, {
          signal: controller.signal,
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => null);
          throw new Error(body?.error ?? `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (!controller.signal.aborted) {
          setResults(data.results ?? []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "Search failed";
        if (!controller.signal.aborted) {
          setError(message);
          console.error("[useTranscriptSearch]", message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    },
    [agentId]
  );

  // Debounced search on query change
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(() => {
      void searchRef.current(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(null);
  }, []);

  return useMemo(
    () => ({ query, setQuery, results, searching, error, clearSearch }),
    [query, setQuery, results, searching, error, clearSearch]
  );
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
