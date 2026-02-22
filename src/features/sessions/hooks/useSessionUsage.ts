import { useCallback, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { parseUsageResult, type UsageRpcResult } from "@/features/sessions/lib/usageParser";

export type SessionUsage = {
  inputTokens: number;
  outputTokens: number;
  totalCost: number | null;
  currency: string;
  messageCount: number;
};

// Re-export for backward compatibility
export { parseUsageResult } from "@/features/sessions/lib/usageParser";

const USAGE_THROTTLE_MS = 5000; // Minimum 5s between sessions.usage calls

export const useSessionUsage = (client: GatewayClient, status: GatewayStatus) => {
  const [sessionUsage, setSessionUsage] = useState<SessionUsage | null>(null);
  const [sessionUsageLoading, setSessionUsageLoading] = useState(false);
  const loadingRef = useRef(false);
  const lastCallRef = useRef(0);

  const loadSessionUsage = useCallback(
    async (sessionKey: string) => {
      if (!sessionKey || status !== "connected" || loadingRef.current) {
        setSessionUsage(null);
        return;
      }
      const now = Date.now();
      if (now - lastCallRef.current < USAGE_THROTTLE_MS) return;
      lastCallRef.current = now;
      loadingRef.current = true;
      setSessionUsageLoading(true);
      try {
        const result = await client.call<UsageRpcResult>("sessions.usage", { key: sessionKey });
        setSessionUsage(parseUsageResult(result));
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          console.error("Failed to load session usage.", err);
        }
        setSessionUsage(null);
      } finally {
        loadingRef.current = false;
        setSessionUsageLoading(false);
      }
    },
    [client, status]
  );

  const resetSessionUsage = useCallback(() => {
    setSessionUsage(null);
    setSessionUsageLoading(false);
  }, []);

  return {
    sessionUsage,
    sessionUsageLoading,
    loadSessionUsage,
    resetSessionUsage,
  };
};

// useCumulativeUsage removed — sessions.usage aggregate eliminated (P0 perf fix)
