"use client";

import React, { useState, useCallback } from "react";
import { Bot, User, Cpu, Wrench, Brain, ChevronRight, ChevronDown } from "lucide-react";
import { formatCostOrEmpty, formatTokensOrEmpty } from "@/lib/text/format";
import type { TraceNode } from "../../lib/traceParser";

const roleIcon: Record<string, React.ReactNode> = {
  user: <User className="h-3.5 w-3.5 text-blue-400" />,
  assistant: <Bot className="h-3.5 w-3.5 text-emerald-400" />,
  system: <Cpu className="h-3.5 w-3.5 text-amber-400" />,
};

const typeIcon: Record<string, React.ReactNode> = {
  thinking: <Brain className="h-3.5 w-3.5 text-purple-400" />,
  tool_call: <Wrench className="h-3.5 w-3.5 text-orange-400" />,
};

type TraceNodeRowProps = {
  node: TraceNode;
  selectedId: string | null;
  maxLatency: number;
  onSelect: (node: TraceNode) => void;
};

export const TraceNodeRow = React.memo(function TraceNodeRow({
  node,
  selectedId,
  maxLatency,
  onSelect,
}: TraceNodeRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  const handleClick = useCallback(() => {
    onSelect(node);
  }, [onSelect, node]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((v) => !v);
    },
    [],
  );

  // Build preview text
  let preview: string;
  if (node.type === "tool_call" && node.toolCall) {
    preview = node.toolCall.name;
  } else if (node.type === "thinking") {
    preview = node.content.length > 60 ? node.content.slice(0, 60) + "…" : node.content;
  } else {
    preview =
      node.content.length > 80 ? node.content.slice(0, 80) + "…" : node.content || "(empty)";
  }

  const icon = node.type === "message" ? roleIcon[node.role] ?? roleIcon.system : typeIcon[node.type];

  const latencyPct =
    node.latencyMs && maxLatency > 0 ? Math.round((node.latencyMs / maxLatency) * 100) : 0;

  const durationMs = node.type === "tool_call" && node.toolCall?.durationMs;

  return (
    <>
      <button
        type="button"
        className={`flex w-full items-center gap-2 border-b border-border/40 px-3 py-2 text-left text-xs transition hover:bg-muted/40 min-h-[44px] ${
          isSelected ? "bg-accent" : ""
        }`}
        style={{ paddingLeft: `${12 + node.depth * 20}px` }}
        onClick={handleClick}
        aria-selected={isSelected}
        role="option"
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0 cursor-pointer text-muted-foreground"
            onClick={handleToggle}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Icon */}
        <span className="shrink-0">{icon}</span>

        {/* Preview */}
        <span className="min-w-0 flex-1 truncate text-foreground/80">
          {node.type === "thinking" && (
            <span className="mr-1 italic text-purple-400/70">thinking</span>
          )}
          {preview}
        </span>

        {/* Tool call duration */}
        {durationMs ? (
          <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:block">
            {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
          </span>
        ) : null}

        {/* Duration bar (message-level latency) */}
        {latencyPct > 0 && (
          <div className="hidden w-16 shrink-0 sm:block" title={`${node.latencyMs}ms`}>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full bg-blue-500/40"
                style={{ width: `${latencyPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tokens (message-level only) */}
        {node.tokens && node.tokens.total > 0 && (
          <span className="hidden w-10 shrink-0 text-right font-mono text-[10px] text-muted-foreground sm:block">
            {formatTokensOrEmpty(node.tokens.total)}
          </span>
        )}

        {/* Cost (message-level only) */}
        {node.cost && node.cost.total > 0 && (
          <span className="hidden w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground md:block">
            {formatCostOrEmpty(node.cost.total)}
          </span>
        )}
      </button>

      {/* Render children if expanded */}
      {hasChildren && expanded && (
        <>
          {node.children.map((child) => (
            <TraceNodeRow
              key={child.id}
              node={child}
              selectedId={selectedId}
              maxLatency={maxLatency}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </>
  );
});
