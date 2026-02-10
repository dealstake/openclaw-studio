import { useCallback, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";

export type SessionUsage = {
  inputTokens: number;
  outputTokens: number;
  totalCost: number | null;
  currency: string;
  messageCount: number;
};

type UsageRpcResult = {
  totals?: {
    input?: number;
    output?: number;
    totalTokens?: number;
    totalCost?: number;
  };
  sessions?: Array<{
    usage?: {
      messageCounts?: {
        total?: number;
      };
    };
  }>;
};

function parseUsageResult(result: UsageRpcResult): SessionUsage {
  const totals = result.totals;
  const messageCount = (result.sessions ?? []).reduce(
    (sum, s) => sum + (s?.usage?.messageCounts?.total ?? 0),
    0
  );
  return {
    inputTokens: totals?.input ?? 0,
    outputTokens: totals?.output ?? 0,
    totalCost: totals?.totalCost != null && totals.totalCost > 0 ? totals.totalCost : null,
    currency: "USD",
    messageCount,
  };
}

export const useSessionUsage = (client: GatewayClient, status: GatewayStatus) => {
  const [sessionUsage, setSessionUsage] = useState<SessionUsage | null>(null);
  const [sessionUsageLoading, setSessionUsageLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadSessionUsage = useCallback(
    async (sessionKey: string) => {
      if (!sessionKey || status !== "connected" || loadingRef.current) {
        setSessionUsage(null);
        return;
      }
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

/** Cumulative usage across ALL sessions (no key filter). */
export const useCumulativeUsage = (client: GatewayClient, status: GatewayStatus) => {
  const [cumulativeUsage, setCumulativeUsage] = useState<SessionUsage | null>(null);
  const [cumulativeUsageLoading, setCumulativeUsageLoading] = useState(false);
  const cumulativeLoadingRef = useRef(false);

  const loadCumulativeUsage = useCallback(async () => {
    if (status !== "connected" || cumulativeLoadingRef.current) {
      setCumulativeUsage(null);
      return;
    }
    cumulativeLoadingRef.current = true;
    setCumulativeUsageLoading(true);
    try {
      const result = await client.call<UsageRpcResult>("sessions.usage", { limit: 500 });
      setCumulativeUsage(parseUsageResult(result));
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        console.error("Failed to load cumulative usage.", err);
      }
      setCumulativeUsage(null);
    } finally {
      cumulativeLoadingRef.current = false;
      setCumulativeUsageLoading(false);
    }
  }, [client, status]);

  const resetCumulativeUsage = useCallback(() => {
    setCumulativeUsage(null);
    setCumulativeUsageLoading(false);
  }, []);

  return {
    cumulativeUsage,
    cumulativeUsageLoading,
    loadCumulativeUsage,
    resetCumulativeUsage,
  };
};
