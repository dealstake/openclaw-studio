import { useSyncExternalStore } from "react";

export const MAX_COMPARISON_SESSIONS = 4;

// --- Module-level store (no React state — safe to use outside components) ---

let comparisonSessionKeys: string[] = [];
let version = 0;
const listeners = new Set<() => void>();
let snapshot: { comparisonSessionKeys: string[]; version: number } = {
  comparisonSessionKeys,
  version,
};

function emit(): void {
  version++;
  snapshot = { comparisonSessionKeys: [...comparisonSessionKeys], version };
  for (const fn of listeners) fn();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): { comparisonSessionKeys: string[]; version: number } {
  return snapshot;
}

// --- Actions ---

/**
 * Add a session key to the comparison set.
 * No-op if already present or if MAX_COMPARISON_SESSIONS is reached.
 */
export function addToComparison(sessionKey: string): void {
  if (comparisonSessionKeys.includes(sessionKey)) return;
  if (comparisonSessionKeys.length >= MAX_COMPARISON_SESSIONS) return;
  comparisonSessionKeys = [...comparisonSessionKeys, sessionKey];
  emit();
}

/**
 * Remove a session key from the comparison set.
 * No-op if not present.
 */
export function removeFromComparison(sessionKey: string): void {
  if (!comparisonSessionKeys.includes(sessionKey)) return;
  comparisonSessionKeys = comparisonSessionKeys.filter((k) => k !== sessionKey);
  emit();
}

/**
 * Toggle a session key in the comparison set.
 * Adds it if absent (respecting MAX_COMPARISON_SESSIONS), removes it if present.
 */
export function toggleComparison(sessionKey: string): void {
  if (comparisonSessionKeys.includes(sessionKey)) {
    removeFromComparison(sessionKey);
  } else {
    addToComparison(sessionKey);
  }
}

/**
 * Clear all session keys from the comparison set.
 */
export function clearComparison(): void {
  if (comparisonSessionKeys.length === 0) return;
  comparisonSessionKeys = [];
  emit();
}

/** Hook: subscribe to the global comparison state. */
export function useComparisonStore(): { comparisonSessionKeys: string[]; version: number } {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
