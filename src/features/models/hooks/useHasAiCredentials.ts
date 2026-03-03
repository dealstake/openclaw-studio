"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import * as credentialService from "@/features/credentials/lib/credentialService";

/**
 * Checks whether AI-category credentials exist in the Credentials vault.
 * Used by BrainKeysSection to suppress "No API keys" warnings when
 * the user has already configured provider keys via Credentials.
 */
export function useHasAiCredentials(
  client: GatewayClient,
  status: GatewayStatus,
): { hasAiCredentials: boolean; loading: boolean } {
  const [hasAiCredentials, setHasAiCredentials] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    try {
      const credentials = await credentialService.listCredentials(client);
      const hasAi = credentials.some(
        (c) => c.category === "ai" && c.status === "connected",
      );
      setHasAiCredentials(hasAi);
    } catch {
      // Fail silently — not critical
      setHasAiCredentials(false);
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    void loadRef.current();
  }, [status]);

  return { hasAiCredentials, loading };
}
