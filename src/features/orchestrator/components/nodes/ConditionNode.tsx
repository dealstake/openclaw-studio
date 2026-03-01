"use client";

/**
 * ConditionNode — React Flow custom node for conditional branching.
 *
 * Evaluates a JS-safe expression against the previous node's output.
 * Has two source handles:
 *   - "true"  (right side) — green, taken when expression evaluates truthy
 *   - "false" (left side)  — red, taken when expression evaluates falsy
 * Target handle on top.
 */

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { GitBranch } from "lucide-react";

// ─── Data type ────────────────────────────────────────────────────────────────

export interface ConditionNodeData extends Record<string, unknown> {
  label: string;
  expression: string;
  trueLabel?: string;
  falseLabel?: string;
}

export type ConditionNodeProps = NodeProps<Node<ConditionNodeData>>;

// ─── Component ────────────────────────────────────────────────────────────────

export const ConditionNode = memo(function ConditionNode({ data, selected }: ConditionNodeProps): React.ReactElement {
  const trueLabel = (data.trueLabel as string | undefined) ?? "Yes";
  const falseLabel = (data.falseLabel as string | undefined) ?? "No";

  return (
    <div
      className={`relative min-w-[160px] max-w-[240px] rounded-xl border-2 border-orange-400/50 bg-card p-3 shadow-md transition-all duration-200 ${selected ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : ""}`}
    >
      {/* Target handle — top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-border !bg-card hover:!border-primary hover:!bg-primary/20"
      />

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-orange-400/15 text-orange-500">
          <GitBranch className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 truncate text-xs font-semibold text-foreground">{String(data.label)}</span>
      </div>

      {/* Expression */}
      <p className="mt-1.5 ml-8 line-clamp-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        {String(data.expression) || "expression…"}
      </p>

      {/* Branch labels */}
      <div className="mt-2 flex justify-between pl-1 pr-1 text-[9px] font-semibold">
        <span className="text-destructive/80">{falseLabel}</span>
        <span className="text-emerald-500">{trueLabel}</span>
      </div>

      {/* Source handle — left (false branch) */}
      <Handle
        type="source"
        position={Position.Left}
        id="false"
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-destructive/50 !bg-destructive/20 hover:!border-destructive hover:!bg-destructive/30"
      />

      {/* Source handle — right (true branch) */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-emerald-500/50 !bg-emerald-500/20 hover:!border-emerald-500 hover:!bg-emerald-500/30"
      />
    </div>
  );
});
