"use client";

/**
 * TriggerNode — React Flow custom node for workflow entry points.
 *
 * Supports: manual, cron, webhook, agent-completion trigger types.
 * Only has a source handle (bottom) — triggers have no incoming edges.
 */

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Play, Clock4, Webhook, Zap } from "lucide-react";
import type { TriggerType } from "../../lib/types";

// ─── Data type ────────────────────────────────────────────────────────────────

export interface TriggerNodeData extends Record<string, unknown> {
  label: string;
  triggerType: TriggerType;
  /** Human-readable config summary (e.g. cron expression, webhook path) */
  configSummary?: string;
}

export type TriggerNodeProps = NodeProps<Node<TriggerNodeData>>;

// ─── Trigger type config ──────────────────────────────────────────────────────

const TRIGGER_CONFIG: Record<TriggerType, { Icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>; color: string; bg: string; border: string }> = {
  manual:             { Icon: Play,    color: "text-sky-500",    bg: "bg-sky-500/15",    border: "border-sky-500/40" },
  cron:               { Icon: Clock4,  color: "text-violet-500", bg: "bg-violet-500/15", border: "border-violet-500/40" },
  webhook:            { Icon: Webhook, color: "text-amber-500",  bg: "bg-amber-500/15",  border: "border-amber-500/40" },
  "agent-completion": { Icon: Zap,     color: "text-emerald-500",bg: "bg-emerald-500/15",border: "border-emerald-500/40" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const TriggerNode = memo(function TriggerNode({ data, selected }: TriggerNodeProps): React.ReactElement {
  const triggerType = (data.triggerType as TriggerType) ?? "manual";
  const { Icon, color, bg, border } = TRIGGER_CONFIG[triggerType] ?? TRIGGER_CONFIG.manual;

  return (
    <div
      className={`relative min-w-[140px] max-w-[220px] rounded-xl border-2 ${border} bg-card p-3 shadow-md transition-all duration-200 ${selected ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : ""}`}
    >
      {/* Triggers have no incoming connections — no target handle */}

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${bg} ${color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 truncate text-xs font-semibold text-foreground">{String(data.label)}</span>
      </div>

      {/* Trigger type badge */}
      <span className={`mt-1.5 ml-8 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${bg} ${color}`}>
        {String(triggerType).replace("-", " ")}
      </span>

      {/* Config summary */}
      {data.configSummary && (
        <p className="mt-1 pl-8 text-[10px] text-muted-foreground/70 truncate">{String(data.configSummary)}</p>
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
