import { useSyncExternalStore } from "react";

interface ReplayTarget {
  agentId: string;
  sessionId: string;
}

// --- Module-level store ---
let replay: ReplayTarget | null = null;
let version = 0;
const listeners = new Set<() => void>();
let snapshot: { replay: ReplayTarget | null; version: number } = { replay, version };

function emit() {
  version++;
  snapshot = { replay, version };
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

/** Open the replay viewer for a given agent + session */
export function openReplay(agentId: string, sessionId: string): void {
  replay = { agentId, sessionId };
  emit();
}

/**
 * Open replay from a raw session key (e.g. "agent:alex:cron:abc").
 * Extracts agentId automatically from the key pattern.
 */
export function openReplayFromKey(sessionKey: string, fallbackAgentId?: string | null): void {
  const parts = sessionKey.split(":");
  let agentId = fallbackAgentId ?? null;
  let sessionId = sessionKey;

  if (parts.length >= 2 && parts[0] === "agent") {
    agentId = parts[1];
    const prefix = `agent:${parts[1]}:`;
    sessionId = sessionKey.startsWith(prefix) ? sessionKey.slice(prefix.length) : sessionKey;
  }

  if (!agentId) return;
  replay = { agentId, sessionId };
  emit();
}

/** Close the replay viewer */
export function closeReplay(): void {
  replay = null;
  emit();
}

// --- Hook ---

/** Subscribe to the global replay view state */
export function useReplayViewStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snap;
}
