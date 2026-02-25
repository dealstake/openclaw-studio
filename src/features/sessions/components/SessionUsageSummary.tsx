"use client";

import { memo } from "react";
import { formatCost, formatTokens } from "@/lib/text/format";
import type { UsageByType } from "@/features/sessions/hooks/useAllSessions";

type UsageData = {
  inputTokens: number;
  outputTokens: number;
  totalCost: number | null;
  messageCount: number;
};

type SessionUsageSummaryProps = {
  aggregateUsage?: UsageData | null;
  aggregateUsageLoading?: boolean;
  cumulativeUsage?: UsageData | null;
  cumulativeUsageLoading?: boolean;
  usageByType?: UsageByType | null;
};

export const SessionUsageSummary = memo(function SessionUsageSummary({
  aggregateUsage = null,
  aggregateUsageLoading = false,
  cumulativeUsage = null,
  cumulativeUsageLoading = false,
  usageByType = null,
}: SessionUsageSummaryProps) {
  const hasContent =
    cumulativeUsage || aggregateUsage || cumulativeUsageLoading || aggregateUsageLoading;

  if (!hasContent) return null;

  return (
    <div className="flex flex-col gap-1.5 border-b border-border/40 px-4 py-2.5">
      {cumulativeUsage && (cumulativeUsage.inputTokens + cumulativeUsage.outputTokens) > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            All Sessions
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="font-semibold text-foreground">
              {formatTokens(cumulativeUsage.inputTokens + cumulativeUsage.outputTokens)} tokens
            </span>
            {cumulativeUsage.totalCost !== null ? (
              <span className="font-semibold text-foreground">
                {formatCost(cumulativeUsage.totalCost, "USD")}
              </span>
            ) : null}
            {cumulativeUsage.messageCount > 0 ? (
              <span className="text-muted-foreground">
                {cumulativeUsage.messageCount.toLocaleString()} messages
              </span>
            ) : null}
          </div>
          {usageByType ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground/80">
              {usageByType.cron > 0 ? <span>{formatTokens(usageByType.cron)} cron</span> : null}
              {usageByType.main > 0 ? <span>{formatTokens(usageByType.main)} main</span> : null}
              {usageByType.subagent > 0 ? (
                <span>{formatTokens(usageByType.subagent)} sub-agent</span>
              ) : null}
              {usageByType.channel > 0 ? (
                <span>{formatTokens(usageByType.channel)} channel</span>
              ) : null}
              {usageByType.unknown > 0 ? (
                <span>{formatTokens(usageByType.unknown)} other</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : cumulativeUsageLoading ? (
        <div className="h-8 w-48 animate-pulse rounded bg-muted/30" />
      ) : null}
      {aggregateUsage ? (
        <div className="flex flex-col gap-0.5">
          <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Current Session
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/80">
            <span>
              {formatTokens(aggregateUsage.inputTokens + aggregateUsage.outputTokens)} tokens
            </span>
            {aggregateUsage.totalCost !== null ? (
              <span>{formatCost(aggregateUsage.totalCost, "USD")}</span>
            ) : null}
            <span>{aggregateUsage.messageCount.toLocaleString()} messages</span>
          </div>
        </div>
      ) : null}
    </div>
  );
});
