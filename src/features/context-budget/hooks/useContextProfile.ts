/**
 * useContextProfile — load and persist per-agent context mode profiles.
 *
 * Reads `config.agents.list[].contextProfile` from gateway and exposes
 * typed profile state + save/reload helpers.
 *
 * Follows the useGuardrails pattern: loadingRef, mountedRef, status-triggered reload.
 * Phase 2: Manual per-file context controls.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";
import { isRecord } from "@/lib/type-guards";
import {
  applyModeChange,
  readContextProfileFromSnapshot,
  setContextProfile,
} from "../lib/contextProfileService";
import type { ContextMode, ContextProfile } from "../types";

export type UseContextProfileResult = {
  /** Current context profile for the agent. Null until loaded. */
  profile: ContextProfile | null;
  loading: boolean;
  /** True while a save is in flight. */
  saving: boolean;
  error: string | null;
  /**
   * Update a single file's context mode and persist immediately.
   * Performs an optimistic update — reverts on failure.
   */
  setMode: (filePath: string, mode: ContextMode) => Promise<void>;
  /** Reload profile from gateway. */
  reload: () => Promise<void>;
};

export function useContextProfile(
  client: GatewayClient,
  status: GatewayStatus,
  agentId: string,
): UseContextProfileResult {
  const [profile, setProfile] = useState<ContextProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (status !== "connected" || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const snapshot = await client.call<GatewayConfigSnapshot>("config.get", {});
      if (!mountedRef.current) return;
      const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
      const loaded = readContextProfileFromSnapshot(
        { config: baseConfig, hash: snapshot.hash, exists: snapshot.exists },
        agentId,
      );
      setProfile(loaded);
    } catch (err) {
      if (!mountedRef.current) return;
      if (!isGatewayDisconnectLikeError(err)) {
        setError(err instanceof Error ? err.message : "Failed to load context profile.");
      }
    } finally {
      if (mountedRef.current) {
        loadingRef.current = false;
        setLoading(false);
      } else {
        loadingRef.current = false;
      }
    }
  }, [client, status, agentId]);

  // Stable ref so status effect does not re-run when load identity changes
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    void loadRef.current();
  }, [status, agentId]);

  const setMode = useCallback(
    async (filePath: string, mode: ContextMode) => {
      if (status !== "connected" || profile === null) return;

      // Optimistic update
      const previous = profile;
      const next = applyModeChange(profile, filePath, mode);
      setProfile(next);
      setSaving(true);
      setError(null);

      try {
        await setContextProfile(client, agentId, next);
      } catch (err) {
        if (!mountedRef.current) return;
        // Revert on failure
        setProfile(previous);
        setError(err instanceof Error ? err.message : "Failed to save context profile.");
        throw err;
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [client, status, agentId, profile],
  );

  return { profile, loading, saving, error, setMode, reload: load };
}
