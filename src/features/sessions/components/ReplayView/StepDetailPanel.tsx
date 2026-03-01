"use client";

import React from "react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { ToolCallCard } from "../TraceViewer/ToolCallCard";
import type { TraceTurn } from "../../lib/traceParser";

type StepDetailPanelProps = {
  turn: TraceTurn | null;
  stepNumber: number | null;
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

export const StepDetailPanel = React.memo(function StepDetailPanel({
  turn,
  stepNumber,
  loading,
}: StepDetailPanelProps) {
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
        Select a step to view details
      </div>
    );
  }

  const timestamp = turn.timestamp ? new Date(turn.timestamp) : null;
  const stepLabel = stepNumber != null ? `Step ${stepNumber + 1}` : "Step";

  return (
    <div className="space-y-4 overflow-auto p-4">
      {/* Step header */}
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {stepNumber != null ? stepNumber + 1 : "?"}
        </span>
        <SectionLabel as="h3">{stepLabel} — {turn.role}</SectionLabel>
      </div>

      {/* Main content */}
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
          <SectionLabel className="mb-1.5">Thinking</SectionLabel>
          <div className="rounded-lg border border-border/40 bg-purple-500/5 p-3">
            <MarkdownViewer content={turn.thinkingContent} className="italic opacity-70" />
          </div>
        </div>
      )}

      {/* Tool calls */}
      {turn.toolCalls.length > 0 && (
        <div>
          <SectionLabel className="mb-1.5">
            Tool Calls ({turn.toolCalls.length})
          </SectionLabel>
          <div className="space-y-2">
            {turn.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id || tc.name} toolCall={tc} defaultExpanded={turn.toolCalls.length === 1} />
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div>
        <SectionLabel className="mb-1.5">Metadata</SectionLabel>
        <div className="space-y-1 rounded-lg border border-border/40 bg-muted/20 p-3">
          <MetaRow label="Role" value={turn.role} />
          <MetaRow label="Model" value={turn.model ?? undefined} />
          <MetaRow label="Stop reason" value={turn.stopReason ?? undefined} />
          {timestamp && (
            <MetaRow label="Timestamp" value={timestamp.toLocaleString()} />
          )}
          {turn.latencyMs != null && (
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
