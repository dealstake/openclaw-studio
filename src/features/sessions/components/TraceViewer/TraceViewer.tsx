"use no memo";
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { useSessionTrace } from "../../hooks/useSessionTrace";
import { turnsToTree } from "../../lib/traceParser";
import type { TraceNode } from "../../lib/traceParser";
import { TraceHeader } from "./TraceHeader";
import { TraceNodeRow } from "./TraceNodeRow";
import { TraceNodeDetail } from "./TraceNodeDetail";

type TraceViewerProps = {
  agentId: string;
  sessionId: string;
  onClose: () => void;
};

export const TraceViewer = React.memo(function TraceViewer({
  agentId,
  sessionId,
  onClose,
}: TraceViewerProps) {
  const {
    turns,
    summary,
    loading,
    error,
    load,
  } = useSessionTrace(agentId, sessionId);

  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Auto-load on mount
  useEffect(() => {
    load();
  }, [load]);

  // Build the tree from flat turns
  const tree = useMemo(() => turnsToTree(turns), [turns]);

  // Flatten tree for keyboard navigation
  const flatNodes = useMemo(() => {
    const result: TraceNode[] = [];
    function walk(nodes: TraceNode[]) {
      for (const n of nodes) {
        result.push(n);
        if (n.children.length > 0) walk(n.children);
      }
    }
    walk(tree);
    return result;
  }, [tree]);

  // Auto-select the first node when tree first loads (derive, don't effect)
  const effectiveSelectedId = selectedNodeId ?? (tree.length > 0 ? tree[0].id : null);

  const selectedNode = useMemo(
    () => flatNodes.find((n) => n.id === effectiveSelectedId) ?? null,
    [flatNodes, effectiveSelectedId],
  );

  const maxLatency = useMemo(
    () => turns.reduce((max, t) => (t.latencyMs && t.latencyMs > max ? t.latencyMs : max), 0),
    [turns],
  );

  const handleSelect = useCallback((node: TraceNode) => {
    setSelectedNodeId(node.id);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (flatNodes.length === 0) return;
      const currentIdx = flatNodes.findIndex((n) => n.id === effectiveSelectedId);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, flatNodes.length - 1);
        setSelectedNodeId(flatNodes[next].id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIdx < 0 ? 0 : Math.max(currentIdx - 1, 0);
        setSelectedNodeId(flatNodes[prev].id);
      }
    },
    [onClose, flatNodes, effectiveSelectedId],
  );

  // Auto-focus container so keyboard events are captured immediately
  useEffect(() => {
    containerRef.current?.focus();
  }, [loading]);

  if (loading && turns.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="flex h-full flex-col rounded-lg border border-border bg-card shadow-lg outline-none"
    >
      {summary && <TraceHeader summary={summary} onClose={onClose} />}

      {error && (
        <div className="px-4 pt-2">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}

      {/* Two-column layout: tree (left) + detail (right) */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Tree list */}
        <div
          className="min-h-0 flex-1 overflow-auto border-b border-border md:max-w-[45%] md:border-b-0 md:border-r"
          role="listbox"
          aria-label="Trace tree"
        >
          {tree.map((node) => (
            <TraceNodeRow
              key={node.id}
              node={node}
              selectedId={effectiveSelectedId}
              maxLatency={maxLatency}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {/* Detail pane */}
        <div className="min-h-0 flex-1 overflow-auto">
          <TraceNodeDetail node={selectedNode} loading={loading} />
        </div>
      </div>
    </div>
  );
});
