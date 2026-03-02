import { useSyncExternalStore } from "react";

// --- Module-level store ---
let forkTreeSessionKey: string | null = null;
let version = 0;
const listeners = new Set<() => void>();
let snapshot: { forkTreeSessionKey: string | null; version: number } = {
  forkTreeSessionKey,
  version,
};

function emit() {
  version++;
  snapshot = { forkTreeSessionKey, version };
  for (const fn of listeners) fn();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return snapshot;
}

// --- Actions ---

/** Open the fork tree view for a session key */
export function openForkTree(sessionKey: string): void {
  forkTreeSessionKey = sessionKey;
  emit();
}

/** Close the fork tree view */
export function closeForkTree(): void {
  forkTreeSessionKey = null;
  emit();
}

// --- Hook ---

export function useForkTreeStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
