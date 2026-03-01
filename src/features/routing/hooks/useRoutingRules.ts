/**
 * useRoutingRules — data hook for smart model routing rules.
 *
 * Loads routing config from gateway via config.get, exposes typed rules,
 * and provides CRUD operations. Follows the useGatewaySettings pattern:
 * loadingRef, mountedRef, stable load ref, reconnect-aware.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { RoutingRule } from "../lib/types";
import {
  parseRoutingConfig,
  addRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
} from "../lib/routingService";

export type UseRoutingRulesResult = {
  rules: RoutingRule[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Reload rules from gateway */
  reload: () => Promise<void>;
  /** Add a new rule — saves immediately */
  createRule: (rule: RoutingRule) => Promise<void>;
  /** Update an existing rule by ID — saves immediately */
  editRule: (id: string, updates: Partial<Omit<RoutingRule, "id">>) => Promise<void>;
  /** Delete a rule by ID — saves immediately */
  removeRule: (id: string) => Promise<void>;
};

export function useRoutingRules(
  client: GatewayClient,
  status: GatewayStatus,
): UseRoutingRulesResult {
  const [rules, setRules] = useState<RoutingRule[]>([]);
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
      const snapshot = await client.call<{ config?: Record<string, unknown>; hash?: string; exists?: boolean }>(
        "config.get",
        {},
      );
      if (!mountedRef.current) return;
      const parsed = parseRoutingConfig(snapshot);
      setRules(parsed.rules);
    } catch (err) {
      if (!mountedRef.current) return;
      if (!isGatewayDisconnectLikeError(err)) {
        setError(
          err instanceof Error ? err.message : "Failed to load routing rules.",
        );
      }
    } finally {
      if (mountedRef.current) {
        loadingRef.current = false;
        setLoading(false);
      } else {
        loadingRef.current = false;
      }
    }
  }, [client, status]);

  // Stable ref so the reconnect effect doesn't re-fire when load identity changes
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    void loadRef.current();
  }, [status]);

  const createRule = useCallback(
    async (rule: RoutingRule) => {
      setSaving(true);
      setError(null);
      try {
        await addRoutingRule(client, rule);
        // Optimistic update
        setRules((prev) => [...prev, rule]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save rule.");
        // Reload to sync state
        void load();
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [client, load],
  );

  const editRule = useCallback(
    async (id: string, updates: Partial<Omit<RoutingRule, "id">>) => {
      setSaving(true);
      setError(null);
      try {
        await updateRoutingRule(client, id, updates);
        // Optimistic update
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update rule.");
        void load();
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [client, load],
  );

  const removeRule = useCallback(
    async (id: string) => {
      setSaving(true);
      setError(null);
      try {
        await deleteRoutingRule(client, id);
        // Optimistic update
        setRules((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete rule.");
        void load();
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [client, load],
  );

  return { rules, loading, saving, error, reload: load, createRule, editRule, removeRule };
}
