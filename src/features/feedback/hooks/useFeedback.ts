"use client";

import { useState, useCallback } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { Annotation, AnnotationRating } from "../lib/types";

// ── Storage helpers ────────────────────────────────────────────────────

const LS_KEY = "studio:annotations:v1";

function readStore(): Record<string, Annotation> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Annotation>) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, Annotation>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    // localStorage quota exceeded — fail silently
  }
}

// ── Types ──────────────────────────────────────────────────────────────

export type UseFeedbackOptions = {
  /**
   * GatewayClient instance — reserved for Phase 2 RPC integration.
   * Currently unused; RPC calls are stubbed in comments below.
   */
  client?: GatewayClient | null;
  sessionKey: string;
  /**
   * Stable message identifier within the session.
   * Convention: `g${groupIndex}` (e.g., "g0", "g1").
   * Stable across re-renders; changes when session resets.
   */
  messageId: string;
};

export type UseFeedbackReturn = {
  annotation: Annotation | null;
  /** Set or toggle a rating. Clicking the active rating removes it. */
  annotate: (rating: AnnotationRating) => void;
  /** Save (or update) the comment on the current annotation. */
  saveComment: (comment: string) => void;
  /** Remove the annotation entirely. */
  remove: () => void;
};

// ── Hook ───────────────────────────────────────────────────────────────

/**
 * Manages annotation CRUD for a single assistant message.
 *
 * Phase 1: localStorage persistence.
 * Phase 2: migrate to gateway RPCs (`annotations.create`, `.list`, `.delete`).
 *
 * @example
 * const { annotation, annotate, saveComment, remove } = useFeedback({
 *   sessionKey: "agent:alex:main",
 *   messageId: "g3",
 * });
 */
export function useFeedback({
  sessionKey,
  messageId,
}: UseFeedbackOptions): UseFeedbackReturn {
  const storeKey = `${sessionKey}:${messageId}`;

  const [annotation, setAnnotation] = useState<Annotation | null>(() => {
    // Lazy initializer — runs once on mount, synchronous localStorage read.
    // Annotation state is subsequently managed by the annotate/saveComment/remove
    // callbacks; no effect-based re-sync needed (component remounts on session change).
    const store = readStore();
    return store[storeKey] ?? null;
  });

  const annotate = useCallback(
    (rating: AnnotationRating) => {
      const store = readStore();
      const existing = store[storeKey];

      // Toggle off if clicking the already-active rating
      if (existing?.rating === rating) {
        delete store[storeKey];
        writeStore(store);
        setAnnotation(null);
        // Phase 2: client?.call("annotations.delete", { id: storeKey }).catch((err) => console.warn("[useFeedback] annotations.delete failed:", err));
        return;
      }

      const next: Annotation = {
        id: storeKey,
        sessionKey,
        messageId,
        rating,
        // Preserve existing comment when switching rating
        comment: existing?.comment,
        createdAt: existing?.createdAt ?? Date.now(),
      };
      store[storeKey] = next;
      writeStore(store);
      setAnnotation(next);
      // Phase 2: client?.call("annotations.create", { sessionKey, messageId, rating, comment: next.comment }).catch((err) => console.warn("[useFeedback] annotations.create failed:", err));
    },
    [storeKey, sessionKey, messageId],
  );

  const saveComment = useCallback(
    (comment: string) => {
      const store = readStore();
      const existing = store[storeKey];
      if (!existing) return;
      const trimmed = comment.trim();
      const next: Annotation = {
        ...existing,
        comment: trimmed.length > 0 ? trimmed : undefined,
      };
      store[storeKey] = next;
      writeStore(store);
      setAnnotation(next);
      // Phase 2: client?.call("annotations.create", { sessionKey, messageId, rating: next.rating, comment: next.comment }).catch((err) => console.warn("[useFeedback] annotations.create failed:", err));
    },
    [storeKey],
  );

  const remove = useCallback(() => {
    const store = readStore();
    delete store[storeKey];
    writeStore(store);
    setAnnotation(null);
    // Phase 2: client?.call("annotations.delete", { id: storeKey }).catch((err) => console.warn("[useFeedback] annotations.delete failed:", err));
  }, [storeKey]);

  return { annotation, annotate, saveComment, remove };
}
