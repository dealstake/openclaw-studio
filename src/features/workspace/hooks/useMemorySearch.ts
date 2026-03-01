"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MemorySearchResult = {
  filePath: string;
  lineNumber: number;
  snippet: string;
  matchCount: number;
};

export type UseMemorySearchResult = {
  query: string;
  setQuery: (q: string) => void;
  results: MemorySearchResult[];
  searching: boolean;
  error: string | null;
  totalMatches: number;
  filesSearched: number;
};

/**
 * Hook for searching across MEMORY.md + memory/*.md files.
 *
 * - 300 ms debounce on keystrokes
 * - Clears results immediately when query is empty
 * - POSTs to /api/workspace/search
 */
export function useMemorySearch(
  agentId: string | null | undefined
): UseMemorySearchResult {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemorySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalMatches, setTotalMatches] = useState(0);
  const [filesSearched, setFilesSearched] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const search = useCallback(
    async (q: string) => {
      if (!agentId || !q.trim()) {
        setResults([]);
        setError(null);
        setTotalMatches(0);
        setFilesSearched(0);
        return;
      }

      setSearching(true);
      setError(null);

      try {
        const res = await fetch("/api/workspace/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, query: q }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            results: MemorySearchResult[];
            totalMatches: number;
            filesSearched: number;
          };
          setResults(data.results ?? []);
          setTotalMatches(data.totalMatches ?? 0);
          setFilesSearched(data.filesSearched ?? 0);
        } else {
          setError(`Search failed (${res.status})`);
          setResults([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [agentId]
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setError(null);
      setTotalMatches(0);
      setFilesSearched(0);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void search(query);
    }, 300);

    return () => {
      clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  return {
    query,
    setQuery,
    results,
    searching,
    error,
    totalMatches,
    filesSearched,
  };
}
