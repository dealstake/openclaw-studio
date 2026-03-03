"use client";

/**
 * useElevenLabsKey — Reads the ElevenLabs API key from the gateway credential vault.
 *
 * Checks `talk.apiKey` and `skills.entries.sag.apiKey` config paths.
 * Returns the key (or null) so voice hooks can pass it to API routes.
 * Caches the key in memory to avoid repeated config.get calls.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useGatewaySafe } from "@/lib/gateway/GatewayProvider";
import { isRecord } from "@/lib/type-guards";

/** Resolve a dot-path to its value in a nested object. */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) => (isRecord(acc) ? acc[key] : undefined),
    obj,
  );
}

const CONFIG_PATHS = ["talk.apiKey", "skills.entries.sag.apiKey"] as const;

export function useElevenLabsKey() {
  const gateway = useGatewaySafe();
  const client = gateway?.client ?? null;
  const status = gateway?.status ?? "disconnected";
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchKey = useCallback(async () => {
    if (status !== "connected" || !client || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    try {
      const snapshot = await client.call<{ config: unknown }>("config.get", {});
      const config = isRecord(snapshot.config) ? snapshot.config : {};
      for (const path of CONFIG_PATHS) {
        const val = resolvePath(config, path);
        if (typeof val === "string" && val.length >= 32) {
          setApiKey(val);
          setLoading(false);
          return;
        }
      }
      setApiKey(null);
    } catch {
      setApiKey(null);
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    void fetchKey();
  }, [fetchKey]);

  // Reset on disconnect so we re-fetch on reconnect
  useEffect(() => {
    if (status !== "connected") {
      fetchedRef.current = false;
    }
  }, [status]);

  return { apiKey, loading };
}
