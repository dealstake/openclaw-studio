import { useCallback, useRef, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { SessionUsage } from "@/features/sessions/hooks/useSessionUsage";
import { parseUsageResult } from "@/features/sessions/lib/usageParser";

/**
 * Parent-level usage cache for SessionCards.
 * Prevents duplicate RPC calls when cards unmount/remount (e.g. virtualized lists, tab switches).
 */
export function useSessionUsageCache(client: GatewayClient) {
  const cacheRef = useRef<Map<string, SessionUsage>>(new Map());
  const inflightRef = useRef<Set<string>>(new Set());
  const [, forceRender] = useState(0);

  const getUsage = useCallback((key: string): SessionUsage | null => {
    return cacheRef.current.get(key) ?? null;
  }, []);

  const loadUsage = useCallback(async (key: string): Promise<SessionUsage | null> => {
    // Already cached
    if (cacheRef.current.has(key)) return cacheRef.current.get(key)!;
    // Already loading
    if (inflightRef.current.has(key)) return null;

    inflightRef.current.add(key);
    try {
      const result = await client.call<{
        totals?: { input?: number; output?: number; totalTokens?: number; totalCost?: number };
        sessions?: Array<{ usage?: { messageCounts?: { total?: number } } }>;
      }>("sessions.usage", { key });
      const usage = parseUsageResult(result);
      cacheRef.current.set(key, usage);
      forceRender((n) => n + 1);
      return usage;
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        console.error("Failed to load session usage:", err);
      }
      return null;
    } finally {
      inflightRef.current.delete(key);
    }
  }, [client]);

  const isLoading = useCallback((key: string): boolean => {
    return inflightRef.current.has(key);
  }, []);

  return { getUsage, loadUsage, isLoading };
}
