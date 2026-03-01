import { useSyncExternalStore } from "react";

interface TraceTarget {
  agentId: string;
  sessionId: string;
}

// --- Module-level store ---
let trace: TraceTarget | null = null;
let version = 0;
const listeners = new Set<() => void>();
let snapshot: { trace: TraceTarget | null; version: number } = { trace, version };

function emit() {
  version++;
  snapshot = { trace, version };
  for (const fn of listeners) fn();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return snapshot;
}

// --- Actions ---

/** Open the trace viewer for a given agent + session */
export function openTrace(agentId: string, sessionId: string): void {
  trace = { agentId, sessionId };
  emit();
}

/**
 * Open trace from a raw session key (e.g. "agent:alex:cron:abc").
 * Extracts agentId automatically from the key pattern.
 */
export function openTraceFromKey(sessionKey: string, fallbackAgentId?: string | null): void {
  const parts = sessionKey.split(":");
  let agentId = fallbackAgentId ?? null;
  let sessionId = sessionKey;

  if (parts.length >= 2 && parts[0] === "agent") {
    agentId = parts[1];
    const prefix = `agent:${parts[1]}:`;
    sessionId = sessionKey.startsWith(prefix)
      ? sessionKey.slice(prefix.length)
      : sessionKey;
  }

  if (!agentId) return;
  trace = { agentId, sessionId };
  emit();
}

/** Close the trace viewer */
export function closeTrace(): void {
  trace = null;
  emit();
}

// --- Hook ---

/** Subscribe to the global trace view state */
export function useTraceViewStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snap;
}
