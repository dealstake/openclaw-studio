/**
 * Auth Profiles — Data hook.
 *
 * Fetches masked auth profiles from the Studio API route.
 * Provides add/remove mutations with optimistic refresh.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAuthProfiles,
  addAuthProfile,
  removeAuthProfile,
} from "@/features/models/lib/authProfileService";
import type { AuthProfileInfo } from "@/features/models/lib/types";

const THROTTLE_MS = 3000;

export interface UseAuthProfilesResult {
  profiles: AuthProfileInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addKey: (id: string, provider: string, token: string) => Promise<void>;
  removeKey: (profileId: string) => Promise<void>;
}

export function useAuthProfiles(agentId: string | null): UseAuthProfilesResult {
  const [profiles, setProfiles] = useState<AuthProfileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const lastCallRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!agentId || loadingRef.current) return;
    const now = Date.now();
    if (now - lastCallRef.current < THROTTLE_MS) return;
    lastCallRef.current = now;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await fetchAuthProfiles(agentId);
      if (!mountedRef.current) return;
      setProfiles(result);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      const message =
        err instanceof Error ? err.message : "Failed to load auth profiles.";
      setError(message);
    } finally {
      if (mountedRef.current) {
        loadingRef.current = false;
        setLoading(false);
      } else {
        loadingRef.current = false;
      }
    }
  }, [agentId]);

  const addKey = useCallback(
    async (id: string, provider: string, token: string) => {
      if (!agentId) return;
      try {
        await addAuthProfile(agentId, id, provider, token);
        lastCallRef.current = 0;
        await refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add key.";
        setError(message);
        throw err;
      }
    },
    [agentId, refresh],
  );

  const removeKey = useCallback(
    async (profileId: string) => {
      if (!agentId) return;
      try {
        await removeAuthProfile(agentId, profileId);
        lastCallRef.current = 0;
        await refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to remove key.";
        setError(message);
        throw err;
      }
    },
    [agentId, refresh],
  );

  return { profiles, loading, error, refresh, addKey, removeKey };
}
