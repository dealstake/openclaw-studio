"use client";

import React from "react";
import { Bot, Clock, Coins, Hash, X } from "lucide-react";

import { SectionLabel } from "@/components/SectionLabel";
import { PanelIconButton } from "@/components/PanelIconButton";
import { formatCost, formatTokens } from "@/lib/text/format";
import { formatDuration } from "@/lib/text/time";
import type { TraceSummary } from "../../lib/traceParser";

type TraceHeaderProps = {
  summary: TraceSummary;
  onClose: () => void;
};

export const TraceHeader = React.memo(function TraceHeader({
  summary,
  onClose,
}: TraceHeaderProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-card/80 px-4 py-3">
      <div className="flex items-center justify-between">
        <SectionLabel as="h3">Session Trace</SectionLabel>
        <PanelIconButton onClick={onClose} aria-label="Close trace viewer">
          <X className="h-3.5 w-3.5" />
        </PanelIconButton>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {summary.model && (
          <span className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px]">
            <Bot className="h-3 w-3" />
            {summary.model}
          </span>
        )}
        <span className="flex items-center gap-1" title="Total turns">
          <Hash className="h-3 w-3" />
          {summary.totalTurns} turns
        </span>
        <span className="flex items-center gap-1" title="Total tokens">
          {formatTokens(summary.totalTokens)} tokens
        </span>
        <span className="flex items-center gap-1" title="Total cost">
          <Coins className="h-3 w-3" />
          {formatCost(summary.totalCost, "USD")}
        </span>
        {summary.totalDurationMs > 0 && (
          <span className="flex items-center gap-1" title="Total duration">
            <Clock className="h-3 w-3" />
            {formatDuration(summary.totalDurationMs)}
          </span>
        )}
      </div>
    </div>
  );
});
