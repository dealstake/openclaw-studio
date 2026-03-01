"use client";

/**
 * usePersonaHealth — client hook for persona preflight health checks.
 *
 * Calls POST /api/personas/[personaId]/health which:
 *  1. Derives capabilities from PERSONA.md Skill Requirements
 *  2. Runs runPreflight (with 5-min server-side cache)
 *  3. Writes the result to PERSONA.md YAML frontmatter
 *  4. Returns the PreflightResult
 *
 * Usage:
 *   const { checkHealth, healthResult, healthStatus, checking } = usePersonaHealth();
 *   await checkHealth("my-persona-id");
 */

import { useCallback, useState } from "react";
import type { PreflightResult, OverallPreflightStatus } from "../lib/preflightTypes";

export interface UsePersonaHealthReturn {
  /** Trigger a health check for the given personaId. */
  checkHealth: (personaId: string) => Promise<PreflightResult | null>;
  /** Whether a health check is currently in progress. */
  checking: boolean;
  /** Last health check result (null until first check completes). */
  healthResult: PreflightResult | null;
  /** Derived overall status (null until first check). */
  healthStatus: OverallPreflightStatus | null;
  /** Error message if last check failed. */
  error: string | null;
  /** Reset all state (e.g. when switching personas). */
  reset: () => void;
}

export function usePersonaHealth(): UsePersonaHealthReturn {
  const [checking, setChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<PreflightResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(
    async (personaId: string): Promise<PreflightResult | null> => {
      setChecking(true);
      setError(null);

      try {
        const res = await fetch(`/api/personas/${encodeURIComponent(personaId)}/health`, {
          method: "POST",
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Health check failed (${res.status})`);
        }

        const result = (await res.json()) as PreflightResult;
        setHealthResult(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Health check failed.";
        setError(msg);
        return null;
      } finally {
        setChecking(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setChecking(false);
    setHealthResult(null);
    setError(null);
  }, []);

  return {
    checkHealth,
    checking,
    healthResult,
    healthStatus: healthResult?.overall ?? null,
    error,
    reset,
  };
}
