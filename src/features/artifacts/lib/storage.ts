/**
 * localStorage helpers for artifacts panel state.
 * Uses `studio:` prefix for consistency with other features.
 */

import type { SortDirection } from "../types";

const PINS_KEY = "studio:artifacts-pins";
const SORT_KEY = "studio:artifacts-sort";

export function loadPins(): Set<string> {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/** Remove pins for file IDs that no longer exist. */
export function pruneStale(pins: Set<string>, validIds: Set<string>): Set<string> {
  const pruned = new Set<string>();
  for (const id of pins) {
    if (validIds.has(id)) pruned.add(id);
  }
  if (pruned.size !== pins.size) savePins(pruned);
  return pruned;
}

export function savePins(pins: Set<string>): void {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify([...pins]));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

export function loadSort(): SortDirection {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    return raw === "oldest" ? "oldest" : "newest";
  } catch {
    return "newest";
  }
}

export function saveSort(dir: SortDirection): void {
  try {
    localStorage.setItem(SORT_KEY, dir);
  } catch {
    /* silently ignore */
  }
}
