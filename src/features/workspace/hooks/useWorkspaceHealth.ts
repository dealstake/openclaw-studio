"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WorkspaceHealthStatus = {
  configured: boolean;
  healthy: boolean;
  mode: "local" | "sidecar";
};

/**
 * Polls /api/workspace/health at a given interval.
 * Returns current sidecar health status.
 */
export function useWorkspaceHealth(intervalMs = 60_000) {
  const [health, setHealth] = useState<WorkspaceHealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/health");
      if (!res.ok) {
        setHealth({ configured: true, healthy: false, mode: "sidecar" });
        setError(`Health check returned ${res.status}`);
        return;
      }
      const data = (await res.json()) as WorkspaceHealthStatus;
      setHealth(data);
      setError(null);
    } catch (err) {
      setHealth({ configured: true, healthy: false, mode: "sidecar" });
      setError(err instanceof Error ? err.message : "Health check failed");
    }
  }, []);

  useEffect(() => {
    // Initial check after a short delay to avoid synchronous setState in effect
    const initialTimer = setTimeout(() => void check(), 0);
    timerRef.current = setInterval(() => void check(), intervalMs);
    return () => {
      clearTimeout(initialTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [check, intervalMs]);

  return { health, error, refresh: check };
}
