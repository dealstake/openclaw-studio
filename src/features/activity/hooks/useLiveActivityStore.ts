"use client";

import { useSyncExternalStore } from "react";

/** Compact metadata for a running (or recently completed) cron/subagent session. */
export interface LiveActivityEntry {
  sessionKey: string;
  taskName: string;
  agentId: string;
  status: "running" | "completed" | "error";
  startedAt: number;
  finishedAt?: number;
  lastAction: string;
  lastToolName: string;
  lastTextSnippet: string;
  streaming: boolean;
}

/** System-level event (exec approval, session lifecycle, cron schedule). */
export interface SystemActivityEvent {
  id: string;
  kind: "exec-approval" | "session-lifecycle" | "cron-schedule";
  icon: string;
  title: string;
  subtitle: string;
  timestamp: number;
}

const MAX_LIVE_SESSIONS = 20;
const MAX_SYSTEM_EVENTS = 50;

// --- Module-level store ---
let sessions = new Map<string, LiveActivityEntry>();
let systemEvents: SystemActivityEvent[] = [];
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  for (const fn of listeners) fn();
}

// --- rAF batching ---
let pendingSessionPatches = new Map<string, Partial<LiveActivityEntry> & { sessionKey: string }>();
let pendingSystemEvents: SystemActivityEvent[] = [];
let rafId: number | null = null;

function flush() {
  const sp = pendingSessionPatches;
  const se = pendingSystemEvents;
  pendingSessionPatches = new Map();
  pendingSystemEvents = [];
  rafId = null;

  if (sp.size > 0) {
    const next = new Map(sessions);
    for (const [key, patch] of sp) {
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, ...patch });
      } else {
        next.set(key, {
          taskName: "",
          agentId: "",
          status: "running",
          startedAt: Date.now(),
          lastAction: "",
          lastToolName: "",
          lastTextSnippet: "",
          streaming: false,
          ...patch,
          sessionKey: key,
        });
      }
    }
    // Evict oldest completed if over limit
    if (next.size > MAX_LIVE_SESSIONS) {
      const sorted = [...next.entries()].sort((a, b) => {
        if (a[1].status === "running" && b[1].status !== "running") return -1;
        if (a[1].status !== "running" && b[1].status === "running") return 1;
        return a[1].startedAt - b[1].startedAt;
      });
      sessions = new Map(sorted.slice(sorted.length - MAX_LIVE_SESSIONS));
    } else {
      sessions = next;
    }
  }

  if (se.length > 0) {
    systemEvents = [...systemEvents, ...se];
    if (systemEvents.length > MAX_SYSTEM_EVENTS) {
      systemEvents = systemEvents.slice(systemEvents.length - MAX_SYSTEM_EVENTS);
    }
  }

  if (sp.size > 0 || se.length > 0) emit();
}

function scheduleFlush() {
  if (rafId === null && typeof requestAnimationFrame !== "undefined") {
    rafId = requestAnimationFrame(flush);
  }
}

// --- Public API ---
export function upsertLiveSession(
  sessionKey: string,
  patch: Partial<LiveActivityEntry> & { sessionKey: string }
) {
  pendingSessionPatches.set(sessionKey, {
    ...pendingSessionPatches.get(sessionKey),
    ...patch,
  });
  scheduleFlush();
}

export function addSystemEvent(event: SystemActivityEvent) {
  pendingSystemEvents.push(event);
  scheduleFlush();
}

// --- React hook ---
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() { return version; }
function getServerSnapshot() { return 0; }

export function useLiveActivityStore() {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { sessions, systemEvents };
}
