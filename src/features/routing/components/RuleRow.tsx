"use client";

import { memo, useCallback } from "react";
import { Pencil, Trash2, Clock, GitBranch, MessageSquare, Heart, Layers, User } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import type { RoutingRule, RoutingCondition, TaskTypeConditionValue } from "../lib/types";
import { TASK_TYPE_LABELS } from "../lib/types";

interface RuleRowProps {
  rule: RoutingRule;
  /** Display name for the model, or fall back to raw model key */
  modelLabel: string;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (rule: RoutingRule) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

const TASK_TYPE_ICON_MAP: Record<TaskTypeConditionValue, React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>> = {
  any: Layers,
  cron: Clock,
  subagent: GitBranch,
  main: MessageSquare,
  heartbeat: Heart,
};

function conditionSummary(conditions: RoutingCondition[]): string {
  if (conditions.length === 0) return "All tasks";
  const parts = conditions.map((c) => {
    if (c.type === "taskType") return TASK_TYPE_LABELS[c.value] ?? c.value;
    if (c.type === "agentId") return c.value === "*" ? "All agents" : `Agent: ${c.value}`;
    return "Unknown";
  });
  return parts.join(" + ");
}

function ConditionIcon({ conditions }: { conditions: RoutingCondition[] }) {
  const taskType = conditions.find((c) => c.type === "taskType");
  const IconComp = taskType
    ? (TASK_TYPE_ICON_MAP[(taskType as { type: "taskType"; value: TaskTypeConditionValue }).value] ?? Layers)
    : Layers;
  return <IconComp className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />;
}

export const RuleRow = memo(function RuleRow({
  rule,
  modelLabel,
  onToggle,
  onEdit,
  onDelete,
  disabled,
}: RuleRowProps) {
  const handleToggle = useCallback(
    () => onToggle(rule.id, !rule.enabled),
    [onToggle, rule.id, rule.enabled],
  );

  const handleEdit = useCallback(() => onEdit(rule), [onEdit, rule]);

  const handleDelete = useCallback(() => onDelete(rule.id), [onDelete, rule.id]);

  // Check if there's an agent condition
  const agentCondition = rule.conditions.find((c) => c.type === "agentId");
  const agentValue = agentCondition
    ? (agentCondition as { type: "agentId"; value: string }).value
    : null;

  return (
    <div
      className={`group flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 transition-opacity ${rule.enabled ? "" : "opacity-60"}`}
      data-testid={`rule-row-${rule.id}`}
    >
      {/* Condition icon */}
      <div className="flex-shrink-0">
        <ConditionIcon conditions={rule.conditions} />
      </div>

      {/* Rule info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground leading-tight" title={rule.name}>
            {rule.name}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="truncate text-xs text-muted-foreground leading-tight" title={conditionSummary(rule.conditions)}>
            {conditionSummary(rule.conditions)}
          </span>
          {agentValue && agentValue !== "*" && (
            <span className="inline-flex items-center gap-0.5 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <User className="h-2.5 w-2.5" aria-hidden />
              {agentValue}
            </span>
          )}
        </div>
      </div>

      {/* Model target badge */}
      <div className="flex-shrink-0">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/20 leading-tight max-w-[100px] truncate" title={modelLabel}>
          {modelLabel}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <ToggleSwitch
          checked={rule.enabled}
          onChange={handleToggle}
          disabled={disabled}
          label={`${rule.enabled ? "Disable" : "Enable"} rule "${rule.name}"`}
        />
        <IconButton
          onClick={handleEdit}
          aria-label={`Edit rule "${rule.name}"`}
          disabled={disabled}
          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 sm:opacity-100 transition-opacity"
        >
          <Pencil className="h-3 w-3" />
        </IconButton>
        <IconButton
          onClick={handleDelete}
          variant="destructive"
          aria-label={`Delete rule "${rule.name}"`}
          disabled={disabled}
          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 sm:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
});
