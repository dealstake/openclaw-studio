"use client";

import React, { useState } from "react";
import { Brain, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { formatElapsedLabel } from "@/lib/text/time";

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
 * Compact collapsible reasoning/thinking block.
 *
 * Collapsed: inline one-liner "💭 Thinking… 3.2s" — no border, minimal chrome.
 * Expanded: full reasoning text in a subtle container.
 * Auto-opens while streaming.
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

  const durationLabel = formatElapsedLabel(startedAt, completedAt, streaming);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="group/thinking flex items-center gap-1.5 rounded-md px-3 py-3 min-h-[44px] sm:px-2 sm:py-1.5 sm:min-h-[36px] text-left transition-colors hover:bg-muted/50">
        {/* Chevron */}
        <ChevronRight
          size={14}
          strokeWidth={1.75}
          className={`shrink-0 text-muted-foreground/50 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />

        {/* Icon with pulse while streaming */}
        <Brain
          size={14}
          strokeWidth={1.75}
          className={`shrink-0 ${
            streaming
              ? "text-muted-foreground animate-pulse"
              : "text-muted-foreground/60"
          }`}
        />

        {/* Label */}
        <span className="text-xs text-muted-foreground/60">
          {streaming ? "Thinking…" : "Thought"}
        </span>

        {/* Duration */}
        {durationLabel ? (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40">
            {durationLabel}
          </span>
        ) : null}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-5 mt-1 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
          {text ? (
            <MarkdownViewer
              content={text}
              className="text-xs text-muted-foreground/70 font-light leading-relaxed"
            />
          ) : streaming ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
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
