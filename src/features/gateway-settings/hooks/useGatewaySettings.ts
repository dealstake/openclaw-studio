/**
 * Gateway Settings — Data hook.
 *
 * Fetches config.get on mount/reconnect and parses into typed settings.
 * Follows the useUsageData pattern: loadingRef, disconnect handling.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { ParsedGatewaySettings } from "../lib/types";
import { parseGatewaySettings } from "../lib/gatewaySettingsService";
import type { GatewayConfigSnapshot } from "@/lib/gateway/agentConfigTypes";

export type UseGatewaySettingsResult = {
  settings: ParsedGatewaySettings | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useGatewaySettings(
  client: GatewayClient,
  status: GatewayStatus,
): UseGatewaySettingsResult {
  const [settings, setSettings] = useState<ParsedGatewaySettings | null>(null);
  const [loading, setLoading] = useState(false);
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
      setSettings(parseGatewaySettings(snapshot));
    } catch (err) {
      if (!mountedRef.current) return;
      if (!isGatewayDisconnectLikeError(err)) {
        setError(
          err instanceof Error ? err.message : "Failed to load gateway settings.",
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

  // Stable ref so the effect doesn't re-run when load identity changes
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    void loadRef.current();
  }, [status]);

  return { settings, loading, error, reload: load };
}
