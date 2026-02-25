"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

import { SectionLabel } from "@/components/SectionLabel";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { Skeleton } from "@/components/Skeleton";
import { ToolCallCard } from "./ToolCallCard";
import type { TraceTurn } from "../../lib/traceParser";

type TraceTurnDetailProps = {
  turn: TraceTurn | null;
  loading?: boolean;
};

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground/80">{value}</span>
    </div>
  );
}

export const TraceTurnDetail = React.memo(function TraceTurnDetail({
  turn,
  loading,
}: TraceTurnDetailProps) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!turn) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
        Select a turn to view details
      </div>
    );
  }

  const timestamp = new Date(turn.timestamp);

  return (
    <div className="space-y-4 overflow-auto p-4">
      {/* Content */}
      {turn.content && (
        <div>
          <SectionLabel className="mb-1.5">Content</SectionLabel>
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <MarkdownViewer content={turn.content} />
          </div>
        </div>
      )}

      {/* Thinking */}
      {turn.thinkingContent && (
        <div>
          <button
            type="button"
            className="mb-1.5 flex items-center gap-1 text-muted-foreground"
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
          >
            {thinkingExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <SectionLabel as="span">Thinking</SectionLabel>
          </button>
          {thinkingExpanded && (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <MarkdownViewer content={turn.thinkingContent} className="italic opacity-70" />
            </div>
          )}
        </div>
      )}

      {/* Tool Calls */}
      {turn.toolCalls.length > 0 && (
        <div>
          <SectionLabel className="mb-1.5">
            Tool Calls ({turn.toolCalls.length})
          </SectionLabel>
          <div className="space-y-2">
            {turn.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div>
        <SectionLabel className="mb-1.5">Metadata</SectionLabel>
        <div className="space-y-1 rounded-lg border border-border/40 bg-muted/20 p-3">
          <MetaRow label="Model" value={turn.model} />
          <MetaRow label="Stop reason" value={turn.stopReason} />
          <MetaRow
            label="Timestamp"
            value={timestamp.toLocaleString()}
          />
          {turn.latencyMs !== null && (
            <MetaRow
              label="Latency"
              value={
                turn.latencyMs < 1000
                  ? `${turn.latencyMs}ms`
                  : `${(turn.latencyMs / 1000).toFixed(1)}s`
              }
            />
          )}

          {/* Token breakdown */}
          {turn.tokens.total > 0 && (
            <>
              <div className="my-1.5 border-t border-border/30" />
              <MetaRow label="Input tokens" value={turn.tokens.input.toLocaleString()} />
              <MetaRow label="Output tokens" value={turn.tokens.output.toLocaleString()} />
              {turn.tokens.cacheRead > 0 && (
                <MetaRow label="Cache read" value={turn.tokens.cacheRead.toLocaleString()} />
              )}
              {turn.tokens.cacheWrite > 0 && (
                <MetaRow label="Cache write" value={turn.tokens.cacheWrite.toLocaleString()} />
              )}
              <MetaRow label="Total tokens" value={turn.tokens.total.toLocaleString()} />
            </>
          )}

          {/* Cost breakdown */}
          {turn.cost.total > 0 && (
            <>
              <div className="my-1.5 border-t border-border/30" />
              <MetaRow label="Input cost" value={`$${turn.cost.input.toFixed(4)}`} />
              <MetaRow label="Output cost" value={`$${turn.cost.output.toFixed(4)}`} />
              <MetaRow label="Total cost" value={`$${turn.cost.total.toFixed(4)}`} />
            </>
          )}
        </div>
      </div>
    </div>
  );
});
