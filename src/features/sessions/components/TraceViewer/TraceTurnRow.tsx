"use client";

import React from "react";
import { Bot, User, Cpu, Wrench } from "lucide-react";

import { formatCost as sharedFormatCost, formatTokens as sharedFormatTokens } from "@/lib/text/format";
import type { TraceTurn } from "../../lib/traceParser";

const roleIcon: Record<string, React.ReactNode> = {
  user: <User className="h-3.5 w-3.5 text-blue-400" />,
  assistant: <Bot className="h-3.5 w-3.5 text-emerald-400" />,
  system: <Cpu className="h-3.5 w-3.5 text-amber-400" />,
};

/** Return empty string for zero values to keep the row clean. */
function formatCost(cost: number): string {
  if (cost === 0) return "";
  return sharedFormatCost(cost, "USD");
}

function formatTokens(n: number): string {
  if (n === 0) return "";
  return sharedFormatTokens(n);
}

type TraceTurnRowProps = {
  turn: TraceTurn;
  isSelected: boolean;
  maxLatency: number;
  onSelect: (index: number) => void;
};

export const TraceTurnRow = React.memo(function TraceTurnRow({
  turn,
  isSelected,
  maxLatency,
  onSelect,
}: TraceTurnRowProps) {
  const preview =
    turn.content.length > 80 ? turn.content.slice(0, 80) + "…" : turn.content || "(empty)";
  const latencyPct =
    turn.latencyMs && maxLatency > 0 ? Math.round((turn.latencyMs / maxLatency) * 100) : 0;

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 border-b border-border/40 px-3 py-2 text-left text-xs transition hover:bg-muted/40 ${
        isSelected ? "bg-accent" : ""
      }`}
      onClick={() => onSelect(turn.index)}
      aria-selected={isSelected}
      role="option"
    >
      {/* Index */}
      <span className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground">
        {turn.index + 1}
      </span>

      {/* Role icon */}
      <span className="shrink-0">{roleIcon[turn.role] ?? roleIcon.system}</span>

      {/* Content preview + tool badge */}
      <span className="min-w-0 flex-1 truncate text-foreground/80">{preview}</span>
      {turn.toolCalls.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          <Wrench className="h-2.5 w-2.5" />
          {turn.toolCalls.length}
        </span>
      )}

      {/* Duration bar */}
      {latencyPct > 0 && (
        <div className="hidden w-16 shrink-0 sm:block" title={`${turn.latencyMs}ms`}>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-blue-500/40"
              style={{ width: `${latencyPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Tokens */}
      <span className="hidden w-10 shrink-0 text-right font-mono text-[10px] text-muted-foreground sm:block">
        {formatTokens(turn.tokens.total)}
      </span>

      {/* Cost */}
      <span className="hidden w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground md:block">
        {formatCost(turn.cost.total)}
      </span>
    </button>
  );
});
