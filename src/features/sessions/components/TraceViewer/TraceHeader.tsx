"use client";

import React from "react";
import { Bot, Clock, Coins, Hash } from "lucide-react";

import { SectionLabel } from "@/components/SectionLabel";
import { PanelIconButton } from "@/components/PanelIconButton";
import type { TraceSummary } from "../../lib/traceParser";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

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
          <span className="text-xs">✕</span>
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
          {formatCost(summary.totalCost)}
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
