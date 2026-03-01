"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ExternalAgent, ExternalAgentsResponse } from "@/features/external-agents/lib/types";

const POLL_INTERVAL_MS = 5_000;

export interface UseExternalAgentsResult {
  agents: ExternalAgent[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  scannedAt: number | null;
}

/**
 * Discovers and tracks running external AI coding agent processes.
 *
 * Polls `GET /api/external-agents` every 5 seconds. Stable `refresh` callback
 * allows on-demand re-scan (e.g. manual refresh button).
 *
 * Only polls when the tab is visible (`document.visibilityState`) to avoid
 * background CPU drain.
 */
export function useExternalAgents(): UseExternalAgentsResult {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<number | null>(null);

  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAgents = useCallback(async (signal?: AbortSignal) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch("/api/external-agents", { signal });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as ExternalAgentsResponse;
      setAgents(data.agents);
      setScannedAt(data.scannedAt);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to scan processes");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void fetchAgents(controller.signal);
  }, [fetchAgents]);

  // Initial load + polling with visibility-aware pause
  useEffect(() => {
    // Initial fetch
    const initialController = new AbortController();
    abortRef.current = initialController;
    void fetchAgents(initialController.signal);

    // Polling interval — skips when tab is hidden
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const controller = new AbortController();
      abortRef.current = controller;
      void fetchAgents(controller.signal);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      abortRef.current?.abort();
    };
  }, [fetchAgents]);

  return { agents, loading, error, refresh, scannedAt };
}
