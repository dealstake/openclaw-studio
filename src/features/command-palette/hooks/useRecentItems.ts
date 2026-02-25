"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { RecentItem } from "../lib/types";

const STORAGE_KEY = "studio:command-palette-recent";
const MAX_RECENT = 5;

let cachedItems: RecentItem[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

function readFromStorage(): RecentItem[] {
  if (cachedItems) return cachedItems;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cachedItems = raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    cachedItems = [];
  }
  return cachedItems;
}

function writeToStorage(items: RecentItem[]) {
  cachedItems = items;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full — silently ignore
  }
  notify();
}

function getSnapshot(): RecentItem[] {
  return readFromStorage();
}

function getServerSnapshot(): RecentItem[] {
  return [];
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useRecentItems() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const trackRecent = useCallback((id: string, label: string) => {
    const current = readFromStorage();
    const filtered = current.filter((item) => item.id !== id);
    const updated = [{ id, label, accessedAt: Date.now() }, ...filtered].slice(
      0,
      MAX_RECENT,
    );
    writeToStorage(updated);
  }, []);

  const clearRecent = useCallback(() => {
    writeToStorage([]);
  }, []);

  return { recentItems: items, trackRecent, clearRecent };
}
