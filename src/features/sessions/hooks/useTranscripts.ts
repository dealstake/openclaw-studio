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
  archiveType?: "reset" | "deleted" | null;
  archivedAt?: string | null;
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
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  };
  model?: string;
  stopReason?: string;
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
const TRANSCRIPTS_PER_PAGE = 50;

/**
 * Fetch the list of session transcripts with pagination support.
 * Loads the first page on mount, exposes `loadMore()` for infinite scroll.
 */
export function useTranscripts(agentId: string | null) {
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageRef = useRef(1);

  const fetchPage = useCallback(async (page: number, append: boolean) => {
    if (!agentId) return;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams({
        agentId,
        page: String(page),
        perPage: String(TRANSCRIPTS_PER_PAGE),
      });
      const resp = await fetch(`/api/sessions/transcripts?${params}`);
      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const newItems: TranscriptEntry[] = data.transcripts ?? [];
      if (append) {
        setTranscripts(prev => [...prev, ...newItems]);
      } else {
        setTranscripts(newItems);
      }
      setHasMore(data.hasMore ?? false);
      setTotalCount(data.count ?? newItems.length);
      pageRef.current = page;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load transcripts";
      setError(message);
      console.error("[useTranscripts]", message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [agentId]);

  const loadRef = useRef(fetchPage);
  loadRef.current = fetchPage;

  // Load first page on agentId change
  useEffect(() => {
    pageRef.current = 1;
    setTranscripts([]);
    setHasMore(false);
    void loadRef.current(1, false);
  }, [agentId]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    void fetchPage(pageRef.current + 1, true);
  }, [hasMore, loadingMore, fetchPage]);

  const refresh = useCallback(() => {
    pageRef.current = 1;
    setTranscripts([]);
    void fetchPage(1, false);
  }, [fetchPage]);

  return { transcripts, loading, loadingMore, error, hasMore, totalCount, loadMore, refresh };
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
