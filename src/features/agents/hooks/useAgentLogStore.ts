"use client";

import { useSyncExternalStore } from "react";
import type { LogLine, AgentLogState, LogStreamStatus } from "../lib/logTypes";
import { LOG_BUFFER_MAX_LINES } from "../lib/logTypes";

// ---------------------------------------------------------------------------
// Agent Log Store
//
// Module-level store using useSyncExternalStore for zero-overhead React binding.
// Stores bounded log line buffers per agent — max LOG_BUFFER_MAX_LINES per agent.
//
// Phase 1 of Agent Log Viewer & Diagnostics feature.
// ---------------------------------------------------------------------------

// --- Module-level state ---
let agentStates = new Map<string, AgentLogState>();
let storeVersion = 0;
const listeners = new Set<() => void>();
let snapshot = { states: agentStates as ReadonlyMap<string, AgentLogState>, version: storeVersion };

function emit(): void {
  storeVersion++;
  snapshot = { states: agentStates, version: storeVersion };
  for (const fn of listeners) fn();
}

// --- Internal helpers ---

function getOrCreate(agentId: string): AgentLogState {
  const existing = agentStates.get(agentId);
  if (existing) return existing;
  const initial: AgentLogState = {
    agentId,
    lines: [],
    status: "idle",
    subscriptionId: null,
    lastLineAt: null,
  };
  agentStates = new Map(agentStates);
  agentStates.set(agentId, initial);
  return initial;
}

function updateAgent(agentId: string, patch: Partial<Omit<AgentLogState, "agentId">>): void {
  const current = getOrCreate(agentId);
  agentStates = new Map(agentStates);
  agentStates.set(agentId, { ...current, ...patch });
  emit();
}

function appendLines(agentId: string, incoming: LogLine[]): void {
  if (incoming.length === 0) return;
  const current = getOrCreate(agentId);
  const combined = [...current.lines, ...incoming];
  const trimmed =
    combined.length > LOG_BUFFER_MAX_LINES
      ? combined.slice(combined.length - LOG_BUFFER_MAX_LINES)
      : combined;

  agentStates = new Map(agentStates);
  agentStates.set(agentId, {
    ...current,
    lines: trimmed,
    lastLineAt: incoming[incoming.length - 1]?.ts ?? current.lastLineAt,
  });
  emit();
}

// --- Public API ---

/** Append one or more log lines for an agent. FIFO-evicts oldest beyond the buffer cap. */
export function appendLogLines(agentId: string, lines: LogLine[]): void {
  appendLines(agentId, lines);
}

/** Append a single log line for an agent. */
export function appendLogLine(agentId: string, line: LogLine): void {
  appendLines(agentId, [line]);
}

/** Replace all lines for an agent (used when loading history). */
export function setLogLines(agentId: string, lines: LogLine[]): void {
  const capped =
    lines.length > LOG_BUFFER_MAX_LINES
      ? lines.slice(lines.length - LOG_BUFFER_MAX_LINES)
      : lines;

  const current = getOrCreate(agentId);
  agentStates = new Map(agentStates);
  agentStates.set(agentId, {
    ...current,
    lines: capped,
    lastLineAt: capped[capped.length - 1]?.ts ?? null,
  });
  emit();
}

/** Update the stream status for an agent. */
export function setLogStreamStatus(
  agentId: string,
  status: LogStreamStatus,
  opts?: { subscriptionId?: string | null; errorMessage?: string },
): void {
  updateAgent(agentId, {
    status,
    subscriptionId: opts?.subscriptionId ?? undefined,
    errorMessage: opts?.errorMessage,
  });
}

/** Clear all log lines for an agent. */
export function clearLogLines(agentId: string): void {
  const current = agentStates.get(agentId);
  if (!current || current.lines.length === 0) return;
  agentStates = new Map(agentStates);
  agentStates.set(agentId, { ...current, lines: [], lastLineAt: null });
  emit();
}

/** Remove an agent's log state entirely (cleanup on unmount). */
export function removeAgentLogState(agentId: string): void {
  if (!agentStates.has(agentId)) return;
  agentStates = new Map(agentStates);
  agentStates.delete(agentId);
  emit();
}

/** Get current state for one agent (for non-React consumers). */
export function getAgentLogState(agentId: string): AgentLogState | undefined {
  return agentStates.get(agentId);
}

/** Clear all agent log states (used in tests / full reset). */
export function clearAllLogStates(): void {
  if (agentStates.size === 0) return;
  agentStates = new Map();
  emit();
}

// --- React bindings ---

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): { states: ReadonlyMap<string, AgentLogState>; version: number } {
  return snapshot;
}

function getServerSnapshot(): { states: ReadonlyMap<string, AgentLogState>; version: number } {
  return { states: new Map(), version: 0 };
}

/**
 * React hook — returns the full log store snapshot.
 * Use `selectAgentLogState(agentId)` on the result to get per-agent state.
 */
export function useAgentLogStore(): { states: ReadonlyMap<string, AgentLogState>; version: number } {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Convenience selector — returns the log state for a single agent.
 * Returns undefined if the agent has no log state yet.
 */
export function useAgentLogState(agentId: string): AgentLogState | undefined {
  const { states } = useAgentLogStore();
  return states.get(agentId);
}
