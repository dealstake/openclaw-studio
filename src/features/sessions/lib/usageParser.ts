import type { SessionUsage } from "../hooks/useSessionUsage";

export type UsageRpcResult = {
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

export function parseUsageResult(result: UsageRpcResult): SessionUsage {
  const totals = result.totals;
  const messageCount = (result.sessions ?? []).reduce(
    (sum, s) => sum + (s?.usage?.messageCounts?.total ?? 0),
    0,
  );
  return {
    inputTokens: totals?.input ?? 0,
    outputTokens: totals?.output ?? 0,
    totalCost: totals?.totalCost != null && totals.totalCost > 0 ? totals.totalCost : null,
    currency: "USD",
    messageCount,
  };
}
