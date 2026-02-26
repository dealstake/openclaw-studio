"use client";

import React, { useState } from "react";
import { Wrench, ChevronRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToolCallBlock, type ToolCallBlockProps } from "./ToolCallBlock";
import { formatElapsedLabel } from "@/lib/text/time";

export type ToolCallGroupProps = {
  /** Individual tool call props */
  tools: (ToolCallBlockProps & { key: string })[];
  className?: string;
};

/**
 * Groups consecutive tool calls into a single collapsible summary row.
 *
 * Collapsed (default): "🔧 5 tools — Complete • 3.2s"
 * Expanded: individual ToolCallBlock items stacked vertically.
 *
 * Single tool call: renders inline ToolCallBlock directly (no grouping chrome).
 */
export const ToolCallGroup = React.memo(function ToolCallGroup({
  tools,
  className = "",
}: ToolCallGroupProps) {
  const [open, setOpen] = useState(false);

  // Single tool — render directly (no grouping wrapper)
  if (tools.length === 1) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { key: _k, ...props } = tools[0];
    return <ToolCallBlock {...props} className={className} />;
  }

  // Derive aggregate status
  const hasRunning = tools.some((t) => t.phase === "running" || t.phase === "pending");
  const hasError = tools.some((t) => t.phase === "error");
  const allComplete = tools.every((t) => t.phase === "complete");

  // Aggregate duration: earliest start → latest completion
  const earliestStart = tools.reduce(
    (min, t) => (t.startedAt && t.startedAt < min ? t.startedAt : min),
    Infinity
  );
  const latestEnd = tools.reduce(
    (max, t) => (t.completedAt && t.completedAt > max ? t.completedAt : max),
    0
  );
  const durationLabel =
    earliestStart < Infinity
      ? formatElapsedLabel(earliestStart, latestEnd > 0 ? latestEnd : undefined, hasRunning)
      : undefined;

  // Status icon + label
  const StatusIcon = hasRunning ? Loader2 : hasError ? AlertCircle : CheckCircle2;
  const statusClass = hasRunning
    ? "text-brand-gold animate-spin"
    : hasError
      ? "text-destructive"
      : "text-emerald-500/70";
  const statusLabel = hasRunning
    ? "Running…"
    : hasError
      ? `${tools.filter((t) => t.phase === "error").length} error${tools.filter((t) => t.phase === "error").length > 1 ? "s" : ""}`
      : allComplete
        ? "Complete"
        : "Done";

  // Tool name summary — e.g., "exec, read, web_search" or "exec ×3, read ×2"
  const nameCounts = new Map<string, number>();
  for (const t of tools) {
    nameCounts.set(t.name, (nameCounts.get(t.name) ?? 0) + 1);
  }
  const namesSummary = [...nameCounts.entries()]
    .map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
    .join(", ");

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={className}
    >
      <CollapsibleTrigger className="group/tool flex w-full items-center gap-1.5 rounded-md px-3 py-3 min-h-[44px] sm:min-h-0 sm:px-1 sm:py-0.5 text-left transition-colors hover:bg-muted/50">
        {/* Chevron */}
        <ChevronRight
          size={14}
          strokeWidth={1.75}
          className={`shrink-0 text-muted-foreground/50 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />

        {/* Tool icon */}
        <Wrench size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground/60" />

        {/* Count */}
        <span className="text-xs font-medium text-foreground/80">
          {tools.length} tools
        </span>

        {/* Names summary */}
        <span className="hidden md:inline truncate text-xs text-muted-foreground/50 max-w-[200px]">
          ({namesSummary})
        </span>

        {/* Phase indicator */}
        <span className="flex items-center gap-1 text-xs">
          <StatusIcon size={14} strokeWidth={1.75} className={statusClass} />
          <span className="text-muted-foreground/60">{statusLabel}</span>
        </span>

        {/* Duration */}
        {durationLabel ? (
          <span className="font-mono text-xs tabular-nums text-muted-foreground/50">
            {durationLabel}
          </span>
        ) : null}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-border/30 pl-2">
          {tools.map(({ key, ...props }) => (
            <ToolCallBlock key={key} {...props} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});
