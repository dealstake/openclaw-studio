/**
 * Guardrails — Data hook.
 *
 * Loads and persists per-agent GuardrailConfig from config.agents.list[].guardrails
 * via config.get / config.patch RPC. Follows the useGatewaySettings pattern:
 * loadingRef, mountedRef, status-triggered reload.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";
import {
  readConfigAgentList,
  upsertConfigAgentEntry,
  writeConfigAgentList,
} from "@/lib/gateway/agentConfigTypes";
import { withGatewayConfigMutation } from "@/lib/gateway/configMutation";
import { isRecord } from "@/lib/type-guards";
import type { GuardrailConfig } from "../lib/types";
import { parseGuardrailConfig, serializeGuardrailConfig } from "../lib/budgetCalculator";

export type UseGuardrailsResult = {
  /** Current guardrail config for the agent. Null until loaded. */
  config: GuardrailConfig | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Save an updated GuardrailConfig to gateway config. */
  save: (next: GuardrailConfig) => Promise<void>;
  /** Reload config from gateway. */
  reload: () => Promise<void>;
};

export function useGuardrails(
  client: GatewayClient,
  status: GatewayStatus,
  agentId: string,
): UseGuardrailsResult {
  const [config, setConfig] = useState<GuardrailConfig | null>(null);
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
      const list = readConfigAgentList(baseConfig);
      const entry = list.find((e) => e.id === agentId);
      const rawGuardrails = entry ? (entry as Record<string, unknown>).guardrails : undefined;
      setConfig(parseGuardrailConfig(rawGuardrails));
    } catch (err) {
      if (!mountedRef.current) return;
      if (!isGatewayDisconnectLikeError(err)) {
        setError(err instanceof Error ? err.message : "Failed to load guardrail config.");
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

  // Stable ref so the status effect doesn't re-run when load identity changes
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    void loadRef.current();
  }, [status, agentId]);

  const save = useCallback(
    async (next: GuardrailConfig) => {
      if (status !== "connected") return;
      setSaving(true);
      setError(null);
      try {
        await withGatewayConfigMutation({
          client,
          mutate: ({ baseConfig, list }) => {
            const serialized = serializeGuardrailConfig(next);
            const { list: nextList } = upsertConfigAgentEntry(list, agentId, (entry) => ({
              ...entry,
              guardrails: serialized,
            }));
            const patch = writeConfigAgentList(baseConfig, nextList);
            return { shouldPatch: true, patch, result: undefined };
          },
        });
        if (!mountedRef.current) return;
        // Optimistic update — reflect saved state immediately
        setConfig(next);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to save guardrail config.");
        throw err;
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [client, status, agentId],
  );

  return { config, loading, saving, error, save, reload: load };
}
