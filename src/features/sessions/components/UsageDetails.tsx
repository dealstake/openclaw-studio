"use client";

import { memo } from "react";
import { formatCost, formatTokens } from "@/lib/text/format";
import type { SessionUsage } from "../hooks/useSessionUsage";

const STAT_LABEL_CLASS = "font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";
const STAT_VALUE_CLASS = "text-[11px] font-semibold text-foreground";
const STAT_CELL_CLASS = "rounded border border-border/50 bg-muted/30 px-2 py-1";

export const UsageDetails = memo(function UsageDetails({ usage }: { usage: SessionUsage }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      <div className={STAT_CELL_CLASS}>
        <div className={STAT_LABEL_CLASS}>Input</div>
        <div className={STAT_VALUE_CLASS}>{formatTokens(usage.inputTokens)}</div>
      </div>
      <div className={STAT_CELL_CLASS}>
        <div className={STAT_LABEL_CLASS}>Output</div>
        <div className={STAT_VALUE_CLASS}>{formatTokens(usage.outputTokens)}</div>
      </div>
      <div className={STAT_CELL_CLASS}>
        <div className={STAT_LABEL_CLASS}>Cost</div>
        <div className={STAT_VALUE_CLASS}>
          {usage.totalCost !== null ? formatCost(usage.totalCost, usage.currency) : "—"}
        </div>
      </div>
      <div className={STAT_CELL_CLASS}>
        <div className={STAT_LABEL_CLASS}>Messages</div>
        <div className={STAT_VALUE_CLASS}>{usage.messageCount.toLocaleString()}</div>
      </div>
    </div>
  );
});

export function UsageSkeleton() {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[38px] animate-pulse rounded border border-border/50 bg-muted/20" />
      ))}
    </div>
  );
}
