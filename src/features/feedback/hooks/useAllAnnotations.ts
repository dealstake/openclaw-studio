"use client";

import { useState, useEffect, useMemo } from "react";
import type { Annotation } from "../lib/types";

const LS_KEY = "studio:annotations:v1";

function readAllAnnotations(): Annotation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const store = JSON.parse(raw) as Record<string, Annotation>;
    return Object.values(store);
  } catch {
    return [];
  }
}

/**
 * Extracts a human-readable agent name from a sessionKey.
 * Supports patterns: "agent:alex:main" → "alex"
 * Falls back to the raw sessionKey if pattern doesn't match.
 */
function agentIdFromSessionKey(sessionKey: string): string {
  const parts = sessionKey.split(":");
  // "agent:<agentId>:<scope>" → parts[1]
  if (parts[0] === "agent" && parts.length >= 2 && parts[1]) {
    return parts[1];
  }
  return sessionKey;
}

export type AgentFeedbackStats = {
  /** Agent identifier (e.g. "alex") */
  agentId: string;
  thumbsUp: number;
  thumbsDown: number;
  flags: number;
  total: number;
};

export type UseAllAnnotationsReturn = {
  annotations: Annotation[];
  /** Per-agent aggregate stats, sorted by total annotation count desc */
  agentStats: AgentFeedbackStats[];
};

/**
 * Reads all stored feedback annotations from localStorage and computes
 * per-agent aggregate stats.
 *
 * Subscribes to the `storage` event to reflect cross-tab updates in real time.
 * Does not require any props — reads the global annotation store.
 *
 * Phase 2: migrate to gateway RPC `annotations.list` when available.
 */
export function useAllAnnotations(): UseAllAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>(() =>
    readAllAnnotations(),
  );

  useEffect(() => {
    // Sync when another tab writes to localStorage
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) {
        setAnnotations(readAllAnnotations());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const agentStats = useMemo<AgentFeedbackStats[]>(() => {
    const map = new Map<string, AgentFeedbackStats>();
    for (const ann of annotations) {
      const agentId = agentIdFromSessionKey(ann.sessionKey);
      const existing = map.get(agentId) ?? {
        agentId,
        thumbsUp: 0,
        thumbsDown: 0,
        flags: 0,
        total: 0,
      };
      existing.total++;
      if (ann.rating === "thumbs_up") existing.thumbsUp++;
      if (ann.rating === "thumbs_down") existing.thumbsDown++;
      if (ann.rating === "flag") existing.flags++;
      map.set(agentId, existing);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [annotations]);

  return { annotations, agentStats };
}
