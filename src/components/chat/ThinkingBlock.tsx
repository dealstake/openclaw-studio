"use client";

import React, { useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarkdownViewer } from "@/components/MarkdownViewer";

export type ThinkingBlockProps = {
  /** The reasoning/thinking text content */
  text: string;
  /** Whether the model is still streaming thinking */
  streaming?: boolean;
  /** Timestamp (ms) when thinking started */
  startedAt?: number;
  /** Timestamp (ms) when thinking completed */
  completedAt?: number;
  className?: string;
};

/**
 * Collapsible reasoning/thinking block.
 *
 * - Shimmer animation while streaming
 * - "Thought for Xs" duration when complete
 * - Collapsed by default when not streaming; open while streaming
 * - Uses MarkdownViewer for content rendering
 */
export const ThinkingBlock = React.memo(function ThinkingBlock({
  text,
  streaming = false,
  startedAt,
  completedAt,
  className = "",
}: ThinkingBlockProps) {
  const [open, setOpen] = useState(streaming);

  // Keep it open while streaming
  React.useEffect(() => {
    if (streaming) setOpen(true);
  }, [streaming]);

  const durationLabel = getDurationLabel(startedAt, completedAt, streaming);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-left transition-colors hover:bg-card">
        {/* Icon with shimmer while streaming */}
        <Brain
          size={14}
          className={`shrink-0 ${
            streaming
              ? "text-brand-gold animate-pulse"
              : "text-muted-foreground"
          }`}
        />

        {/* Label */}
        <span className="text-xs font-medium text-muted-foreground">
          {streaming ? "Thinking…" : "Thought"}
        </span>

        {/* Duration */}
        {durationLabel ? (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
            {durationLabel}
          </span>
        ) : null}

        {/* Chevron */}
        <ChevronDown
          size={12}
          className={`ml-auto shrink-0 text-muted-foreground/50 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
          {text ? (
            <MarkdownViewer
              content={text}
              className="text-muted-foreground opacity-80"
            />
          ) : streaming ? (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-brand-gold/60" />
              <span className="text-[10px] text-muted-foreground/50">
                Reasoning…
              </span>
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

/* ── Helpers ── */

function getDurationLabel(
  startedAt?: number,
  completedAt?: number,
  streaming?: boolean,
): string | null {
  if (streaming) return null;
  if (startedAt != null && completedAt != null) {
    const secs = Math.max(0, Math.round((completedAt - startedAt) / 1000));
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}m ${String(rem).padStart(2, "0")}s`;
  }
  return null;
}
