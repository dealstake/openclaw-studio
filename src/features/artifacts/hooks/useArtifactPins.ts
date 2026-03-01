"use client";

import { useCallback, useState } from "react";
import type { SortDirection } from "../types";
import { loadPins, savePins, loadSort, saveSort, pruneStale } from "../lib/storage";

/**
 * Manages pin state and sort direction for artifacts.
 * Persists to localStorage with `studio:` prefix.
 */
export function useArtifactPins() {
  // Lazy initializers — run once on mount, no effect needed
  const [pins, setPins] = useState<Set<string>>(() => loadPins());
  const [sortDir, setSortDir] = useState<SortDirection>(() => loadSort());

  const toggleSort = useCallback(() => {
    setSortDir((prev) => {
      const next = prev === "newest" ? "oldest" : "newest";
      saveSort(next);
      return next;
    });
  }, []);

  const togglePin = useCallback((id: string) => {
    setPins((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savePins(next);
      return next;
    });
  }, []);

  /** Remove pins for file IDs that no longer exist in the fetched file list. */
  const pruneWith = useCallback((validIds: Set<string>) => {
    setPins((prev) => pruneStale(prev, validIds));
  }, []);

  return { pins, sortDir, toggleSort, togglePin, pruneWith };
}
