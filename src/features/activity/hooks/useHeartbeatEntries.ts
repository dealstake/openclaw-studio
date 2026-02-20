"use client";

import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Heartbeat Entry Store — routes heartbeat events from the gateway into the
// Activity Drawer. Uses useSyncExternalStore for zero-overhead React binding.
// ---------------------------------------------------------------------------

export type HeartbeatEntry = {
  runId: string;
  timestamp: number;
  text: string;
  status: "ok" | "alert";
};

const MAX_ENTRIES = 50;

let entries: HeartbeatEntry[] = [];
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version++;
  for (const fn of listeners) fn();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot(): HeartbeatEntry[] {
  return entries;
}

function getServerSnapshot(): HeartbeatEntry[] {
  return [];
}

/** Push a heartbeat entry (called from event handler). */
export function pushHeartbeatEntry(entry: HeartbeatEntry): void {
  // Deduplicate by runId
  if (entries.some((e) => e.runId === entry.runId)) return;
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  notify();
}

/** Clear all entries. */
export function clearHeartbeatEntries(): void {
  if (entries.length === 0) return;
  entries = [];
  notify();
}

/** React hook — returns current heartbeat entries (newest first). */
export function useHeartbeatEntries(): HeartbeatEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Get the latest alert (non-ok) entry, if any. */
export function useLatestHeartbeatAlert(): HeartbeatEntry | null {
  const all = useHeartbeatEntries();
  return all.find((e) => e.status === "alert") ?? null;
}

/** Get version for change detection. */
export function getHeartbeatVersion(): number {
  return version;
}
