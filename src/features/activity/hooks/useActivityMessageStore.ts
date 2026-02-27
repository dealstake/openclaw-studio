"use client";

import { useSyncExternalStore } from "react";
import type { MessagePart } from "@/lib/chat/types";

// ---------------------------------------------------------------------------
// Activity Message Store — holds full MessagePart[] per event source.
// Uses module-level state + useSyncExternalStore for zero-overhead React binding.
// Phase 2 of Activity Context Panel Tab project.
// ---------------------------------------------------------------------------

export type ActivitySourceType = "heartbeat" | "cron" | "subagent" | "system";

export interface ActivityMessage {
  /** Unique key — typically the session key or a generated ID */
  sourceKey: string;
  /** Display name (e.g., task name, "Heartbeat") */
  sourceName: string;
  /** Category for filtering */
  sourceType: ActivitySourceType;
  /** Full message parts — text, thinking, tool calls */
  parts: MessagePart[];
  /** When the message was created or started */
  timestamp: number;
  /** Current streaming status */
  status: "streaming" | "complete" | "error";
  /** Input tokens consumed (populated from gateway events) */
  tokensIn?: number | null;
  /** Output tokens consumed (populated from gateway events) */
  tokensOut?: number | null;
  /** Total cost in USD (populated from gateway events) */
  totalCost?: number | null;
}

const MAX_ENTRIES = 200;

// --- Module-level store ---
let messages: ActivityMessage[] = [];
let version = 0;
const listeners = new Set<() => void>();
let snapshot = { messages: messages as readonly ActivityMessage[], version };

function emit() {
  version++;
  snapshot = { messages, version };
  for (const fn of listeners) fn();
}

// --- Internal helpers (DRY: shared by upsert + append) ---

/** Replace entry at index with merged data, returning new array. */
function replaceAt(idx: number, patch: Partial<ActivityMessage>): ActivityMessage[] {
  const existing = messages[idx];
  return [
    ...messages.slice(0, idx),
    { ...existing, ...patch },
    ...messages.slice(idx + 1),
  ];
}

/** Create a new entry with defaults, append it, and apply FIFO eviction. */
function createAndAppend(entry: ActivityMessage): ActivityMessage[] {
  const next = [...messages, entry];
  return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
}

// --- Public API ---

/** Append or update a message by sourceKey. */
export function upsertActivityMessage(
  sourceKey: string,
  patch: Partial<ActivityMessage> & { sourceKey: string },
): void {
  const idx = messages.findIndex((m) => m.sourceKey === sourceKey);
  if (idx >= 0) {
    messages = replaceAt(idx, patch);
  } else {
    messages = createAndAppend({
      sourceName: "",
      sourceType: "system",
      parts: [],
      timestamp: Date.now(),
      status: "streaming",
      ...patch,
      sourceKey,
    });
  }
  emit();
}

/** Append parts to an existing message (or create it). */
export function appendActivityParts(
  sourceKey: string,
  parts: MessagePart[],
  meta?: Partial<Omit<ActivityMessage, "sourceKey" | "parts">>,
): void {
  const idx = messages.findIndex((m) => m.sourceKey === sourceKey);
  if (idx >= 0) {
    messages = replaceAt(idx, {
      ...meta,
      parts: [...messages[idx].parts, ...parts],
    });
  } else {
    messages = createAndAppend({
      sourceName: meta?.sourceName ?? "",
      sourceType: meta?.sourceType ?? "system",
      timestamp: meta?.timestamp ?? Date.now(),
      status: meta?.status ?? "streaming",
      sourceKey,
      parts,
    });
  }
  emit();
}

/** Finalize a message (mark complete or error). */
export function finalizeActivityMessage(
  sourceKey: string,
  status: "complete" | "error",
): void {
  const idx = messages.findIndex((m) => m.sourceKey === sourceKey);
  if (idx < 0) return;
  messages = [
    ...messages.slice(0, idx),
    { ...messages[idx], status },
    ...messages.slice(idx + 1),
  ];
  emit();
}

/** Clear all messages. */
export function clearActivityMessages(): void {
  if (messages.length === 0) return;
  messages = [];
  emit();
}

/** Get messages snapshot (for non-React consumers). */
export function getActivityMessages(): readonly ActivityMessage[] {
  return messages;
}

// --- React hook ---
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot(): { messages: readonly ActivityMessage[]; version: number } {
  return snapshot;
}

function getServerSnapshot(): { messages: readonly ActivityMessage[]; version: number } {
  return { messages: [], version: 0 };
}

/** React hook — returns current activity messages (oldest first). */
export function useActivityMessageStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
