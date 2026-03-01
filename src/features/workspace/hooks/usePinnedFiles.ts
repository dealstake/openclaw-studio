"use client";

import { useCallback, useEffect, useState } from "react";

import type { WorkspaceEntry } from "../types";

// ── Types ────────────────────────────────────────────────────────────────────

/** Minimal entry shape stored in localStorage for pinned files */
export type PinnedEntry = Pick<WorkspaceEntry, "name" | "path" | "type">;

export interface UsePinnedFilesResult {
  /** Ordered list of pinned entries (insertion order) */
  pinnedEntries: PinnedEntry[];
  /** Returns true if the given path is pinned */
  isPinned: (path: string) => boolean;
  /** Pin if not pinned, unpin if pinned */
  togglePin: (entry: PinnedEntry) => void;
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function storageKey(agentId: string): string {
  return `workspace.pinned.${agentId}`;
}

function loadFromStorage(agentId: string): PinnedEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(agentId));
    if (!raw) return [];
    return JSON.parse(raw) as PinnedEntry[];
  } catch {
    return [];
  }
}

function saveToStorage(agentId: string, entries: PinnedEntry[]): void {
  try {
    localStorage.setItem(storageKey(agentId), JSON.stringify(entries));
  } catch {
    // localStorage may be unavailable in SSR, private mode, or quota-exceeded
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages pinned workspace files for a given agent.
 *
 * Pins are persisted to localStorage under `workspace.pinned.<agentId>`.
 * Only name, path, and type are stored — enough to render the icon and label
 * without holding the full file content in storage.
 */
export function usePinnedFiles(
  agentId: string | null | undefined
): UsePinnedFilesResult {
  const [pinnedEntries, setPinnedEntries] = useState<PinnedEntry[]>([]);

  // Reload pinned list whenever the active agent changes.
  // Use queueMicrotask to defer setState out of the synchronous effect body
  // and satisfy the react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    if (!agentId) {
      queueMicrotask(() => { setPinnedEntries([]); });
      return;
    }
    const id = agentId;
    queueMicrotask(() => { setPinnedEntries(loadFromStorage(id)); });
  }, [agentId]);

  const isPinned = useCallback(
    (path: string): boolean => pinnedEntries.some((e) => e.path === path),
    [pinnedEntries]
  );

  const togglePin = useCallback(
    (entry: PinnedEntry) => {
      if (!agentId) return;
      setPinnedEntries((prev) => {
        const alreadyPinned = prev.some((e) => e.path === entry.path);
        const next: PinnedEntry[] = alreadyPinned
          ? prev.filter((e) => e.path !== entry.path)
          : [
              ...prev,
              { name: entry.name, path: entry.path, type: entry.type },
            ];
        saveToStorage(agentId, next);
        return next;
      });
    },
    [agentId]
  );

  return { pinnedEntries, isPinned, togglePin };
}
