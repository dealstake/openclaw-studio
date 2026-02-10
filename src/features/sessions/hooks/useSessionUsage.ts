import { useCallback, useState } from "react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";

export type SessionUsage = {
  inputTokens: number;
  outputTokens: number;
  totalCost: number | null;
  currency: string;
  messageCount: number;
};

export const useSessionUsage = (client: GatewayClient, status: GatewayStatus) => {
  const [sessionUsage, setSessionUsage] = useState<SessionUsage | null>(null);
  const [sessionUsageLoading, setSessionUsageLoading] = useState(false);

  const loadSessionUsage = useCallback(
    async (sessionKey: string) => {
      if (!sessionKey || status !== "connected") {
        setSessionUsage(null);
        return;
      }
      setSessionUsageLoading(true);
      try {
        const result = await client.call<{
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
        }>("sessions.usage", { key: sessionKey });
        const totals = result.totals;
        const firstSession = result.sessions?.[0];
        setSessionUsage({
          inputTokens: totals?.input ?? 0,
          outputTokens: totals?.output ?? 0,
          totalCost: totals?.totalCost != null && totals.totalCost > 0 ? totals.totalCost : null,
          currency: "USD",
          messageCount: firstSession?.usage?.messageCounts?.total ?? 0,
        });
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          console.error("Failed to load session usage.", err);
        }
        setSessionUsage(null);
      } finally {
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
