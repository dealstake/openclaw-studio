"use client";

import React from "react";

import { SectionLabel } from "@/components/SectionLabel";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { Skeleton } from "@/components/Skeleton";
import { ToolCallCard } from "./ToolCallCard";
import type { TraceNode } from "../../lib/traceParser";

type TraceNodeDetailProps = {
  node: TraceNode | null;
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

export const TraceNodeDetail = React.memo(function TraceNodeDetail({
  node,
  loading,
}: TraceNodeDetailProps) {
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

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
        Select a node to view details
      </div>
    );
  }

  // Tool call detail
  if (node.type === "tool_call" && node.toolCall) {
    return (
      <div className="space-y-4 overflow-auto p-4">
        <SectionLabel className="mb-1.5">Tool Call</SectionLabel>
        <ToolCallCard toolCall={node.toolCall} defaultExpanded />
      </div>
    );
  }

  // Thinking detail
  if (node.type === "thinking") {
    return (
      <div className="space-y-4 overflow-auto p-4">
        <SectionLabel className="mb-1.5">Thinking</SectionLabel>
        <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
          <MarkdownViewer content={node.content} className="italic opacity-70" />
        </div>
      </div>
    );
  }

  // Message detail
  const timestamp = node.timestamp ? new Date(node.timestamp) : null;

  return (
    <div className="space-y-4 overflow-auto p-4">
      {/* Content */}
      {node.content && (
        <div>
          <SectionLabel className="mb-1.5">Content</SectionLabel>
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <MarkdownViewer content={node.content} />
          </div>
        </div>
      )}

      {/* Metadata */}
      <div>
        <SectionLabel className="mb-1.5">Metadata</SectionLabel>
        <div className="space-y-1 rounded-lg border border-border/40 bg-muted/20 p-3">
          <MetaRow label="Role" value={node.role} />
          <MetaRow label="Model" value={node.model ?? undefined} />
          <MetaRow label="Stop reason" value={node.stopReason ?? undefined} />
          {timestamp && (
            <MetaRow label="Timestamp" value={timestamp.toLocaleString()} />
          )}
          {node.latencyMs != null && (
            <MetaRow
              label="Latency"
              value={
                node.latencyMs < 1000
                  ? `${node.latencyMs}ms`
                  : `${(node.latencyMs / 1000).toFixed(1)}s`
              }
            />
          )}

          {/* Token breakdown */}
          {node.tokens && node.tokens.total > 0 && (
            <>
              <div className="my-1.5 border-t border-border/30" />
              <MetaRow label="Input tokens" value={node.tokens.input.toLocaleString()} />
              <MetaRow label="Output tokens" value={node.tokens.output.toLocaleString()} />
              {node.tokens.cacheRead > 0 && (
                <MetaRow label="Cache read" value={node.tokens.cacheRead.toLocaleString()} />
              )}
              {node.tokens.cacheWrite > 0 && (
                <MetaRow label="Cache write" value={node.tokens.cacheWrite.toLocaleString()} />
              )}
              <MetaRow label="Total tokens" value={node.tokens.total.toLocaleString()} />
            </>
          )}

          {/* Cost breakdown */}
          {node.cost && node.cost.total > 0 && (
            <>
              <div className="my-1.5 border-t border-border/30" />
              <MetaRow label="Input cost" value={`$${node.cost.input.toFixed(4)}`} />
              <MetaRow label="Output cost" value={`$${node.cost.output.toFixed(4)}`} />
              <MetaRow label="Total cost" value={`$${node.cost.total.toFixed(4)}`} />
            </>
          )}
        </div>
      </div>
    </div>
  );
});
