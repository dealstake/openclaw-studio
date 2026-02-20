"use client";

import React, { useState } from "react";
import { Wrench, ChevronDown, Clock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatElapsedLabel } from "@/lib/text/time";

export type ToolCallPhase = "pending" | "running" | "complete" | "error";

export type ToolCallBlockProps = {
  /** Tool name (e.g. "web_search", "exec") */
  name: string;
  /** Current execution phase */
  phase: ToolCallPhase;
  /** Serialized arguments (JSON string) */
  args?: string;
  /** Tool result text */
  result?: string;
  /** Timestamp (ms) when tool call started */
  startedAt?: number;
  /** Timestamp (ms) when tool call completed */
  completedAt?: number;
  className?: string;
};

const phaseConfig: Record<
  ToolCallPhase,
  { label: string; Icon: React.ElementType; iconClass: string }
> = {
  pending: {
    label: "Pending",
    Icon: Clock,
    iconClass: "text-muted-foreground",
  },
  running: {
    label: "Running…",
    Icon: Loader2,
    iconClass: "text-brand-gold animate-spin",
  },
  complete: {
    label: "Complete",
    Icon: CheckCircle2,
    iconClass: "text-emerald-500",
  },
  error: {
    label: "Error",
    Icon: AlertCircle,
    iconClass: "text-destructive",
  },
};

/**
 * Tool call display block.
 *
 * - Shows tool name + phase badge (pending/running/complete/error)
 * - Running state: spinner animation
 * - Complete/error state: duration display, collapsible args & result
 * - Result rendered via MarkdownViewer; errors via ErrorBanner
 */
export const ToolCallBlock = React.memo(function ToolCallBlock({
  name,
  phase,
  args,
  result,
  startedAt,
  completedAt,
  className = "",
}: ToolCallBlockProps) {
  const [open, setOpen] = useState(phase === "running");
  const config = phaseConfig[phase];
  const { Icon } = config;

  // Keep open while running
  React.useEffect(() => {
    if (phase === "running") setOpen(true);
  }, [phase]);

  const durationLabel = formatElapsedLabel(startedAt, completedAt, phase === "running" || phase === "pending" ? true : undefined);
  const hasContent = !!(args || result);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-left transition-colors hover:bg-card">
        {/* Tool icon */}
        <Wrench size={14} className="shrink-0 text-muted-foreground" />

        {/* Tool name */}
        <span className="text-xs font-medium text-foreground">{name}</span>

        {/* Phase badge */}
        <span
          className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${phaseBadgeClass(phase)}`}
        >
          <Icon size={10} className={config.iconClass} />
          {config.label}
        </span>

        {/* Duration */}
        {durationLabel ? (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
            {durationLabel}
          </span>
        ) : null}

        {/* Chevron — only if there's expandable content */}
        {hasContent && (
          <ChevronDown
            size={12}
            className={`ml-auto shrink-0 text-muted-foreground/50 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </CollapsibleTrigger>

      {hasContent && (
        <CollapsibleContent>
          <div className="mt-1 space-y-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
            {/* Arguments */}
            {args && (
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  Args
                </span>
                <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                  {formatArgs(args)}
                </pre>
              </div>
            )}

            {/* Result */}
            {result && phase === "error" ? (
              <ErrorBanner message={result} />
            ) : result ? (
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  Result
                </span>
                <MarkdownViewer
                  content={result}
                  className="mt-0.5 text-muted-foreground opacity-80"
                />
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
});

/* ── Helpers ── */

function phaseBadgeClass(phase: ToolCallPhase): string {
  switch (phase) {
    case "pending":
      return "bg-muted text-muted-foreground";
    case "running":
      return "bg-brand-gold/10 text-brand-gold";
    case "complete":
      return "bg-emerald-500/10 text-emerald-500";
    case "error":
      return "bg-destructive/10 text-destructive";
  }
}

function formatArgs(args: string): string {
  try {
    return JSON.stringify(JSON.parse(args), null, 2);
  } catch {
    return args;
  }
}
