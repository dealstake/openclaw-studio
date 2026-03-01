"use client";

/**
 * AgentNode — React Flow custom node for an agent execution step.
 *
 * Displays: agent label, model override badge, prompt override preview,
 * execution status overlay (pending / running / success / error).
 * Source handle: bottom. Target handle: top.
 */

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Bot, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { NodeExecutionStatus } from "../../lib/types";

// ─── Data type ────────────────────────────────────────────────────────────────

export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  agentId: string;
  modelOverride?: string;
  promptOverride?: string;
  executionStatus?: NodeExecutionStatus;
  executionOutput?: string;
}

export type AgentNodeProps = NodeProps<Node<AgentNodeData>>;

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<NodeExecutionStatus, string> = {
  pending:  "border-border/60 bg-card",
  running:  "border-primary/60 bg-primary/5 shadow-[0_0_12px_2px_rgba(var(--primary-rgb),0.15)]",
  success:  "border-emerald-500/60 bg-emerald-500/5",
  error:    "border-destructive/60 bg-destructive/5",
  skipped:  "border-muted/40 bg-muted/10 opacity-60",
};

function StatusIcon({ status }: { status: NodeExecutionStatus }): React.ReactElement | null {
  switch (status) {
    case "running":
      return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
    case "success":
      return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
    case "error":
      return <XCircle className="h-3 w-3 text-destructive" />;
    case "skipped":
      return <Clock className="h-3 w-3 text-muted-foreground" />;
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AgentNode = memo(function AgentNode({ data, selected }: AgentNodeProps): React.ReactElement {
  const execStatus = (data.executionStatus as NodeExecutionStatus | undefined) ?? "pending";
  const borderStyle = STATUS_STYLES[execStatus];

  return (
    <div
      className={`relative min-w-[160px] max-w-[240px] rounded-xl border-2 p-3 shadow-md transition-all duration-200 ${borderStyle} ${selected ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : ""}`}
    >
      {/* Target handle — top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-border !bg-card hover:!border-primary hover:!bg-primary/20"
      />

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 truncate text-xs font-semibold text-foreground">{String(data.label)}</span>
        {execStatus !== "pending" && (
          <StatusIcon status={execStatus} />
        )}
      </div>

      {/* Agent ID subtitle */}
      <p className="mt-1 truncate pl-8 text-[10px] text-muted-foreground">{String(data.agentId)}</p>

      {/* Model override badge */}
      {data.modelOverride && (
        <span className="mt-1.5 ml-8 inline-block rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
          {String(data.modelOverride)}
        </span>
      )}

      {/* Prompt override preview */}
      {data.promptOverride && (
        <p className="mt-1.5 ml-8 line-clamp-2 text-[10px] italic text-muted-foreground/70">
          &ldquo;{String(data.promptOverride)}&rdquo;
        </p>
      )}

      {/* Execution output snippet */}
      {data.executionOutput && execStatus === "success" && (
        <p className="mt-1.5 ml-8 line-clamp-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
          {String(data.executionOutput)}
        </p>
      )}
      {data.executionOutput && execStatus === "error" && (
        <p className="mt-1.5 ml-8 line-clamp-2 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
          {String(data.executionOutput)}
        </p>
      )}

      {/* Source handle — bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-border !bg-card hover:!border-primary hover:!bg-primary/20"
      />
    </div>
  );
});
