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

/** Type guard for RecentItem to safely validate localStorage data */
function isRecentItem(v: unknown): v is RecentItem {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as RecentItem).id === "string" &&
    typeof (v as RecentItem).label === "string" &&
    typeof (v as RecentItem).accessedAt === "number"
  );
}

function parseRecentItems(raw: string | null): RecentItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentItem);
  } catch {
    return [];
  }
}

function readFromStorage(): RecentItem[] {
  if (cachedItems) return cachedItems;
  cachedItems = parseRecentItems(localStorage.getItem(STORAGE_KEY));
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

// Cross-tab sync: listen for storage changes from other tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cachedItems = parseRecentItems(e.newValue);
      notify();
    }
  });
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
