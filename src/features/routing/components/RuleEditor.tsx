"use client";

import { memo, useCallback, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetTitle,
  SideSheetClose,
  SideSheetBody,
} from "@/components/ui/SideSheet";
import { Button } from "@/components/ui/button";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import type {
  RoutingRule,
  RoutingCondition,
  TaskTypeConditionValue,
} from "../lib/types";
import { TASK_TYPE_LABELS } from "../lib/types";

interface RuleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rule to edit — null means "create new" */
  rule: RoutingRule | null;
  models: GatewayModelChoice[];
  agentIds: string[];
  onSave: (rule: RoutingRule) => Promise<void>;
  saving: boolean;
}

const TASK_TYPE_OPTIONS: { value: TaskTypeConditionValue; label: string }[] =
  Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({
    value: value as TaskTypeConditionValue,
    label,
  }));

function generateId(): string {
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeDefaultRule(models: GatewayModelChoice[]): RoutingRule {
  const firstModel =
    models.length > 0 ? `${models[0].provider}/${models[0].id}` : "";
  return {
    id: generateId(),
    name: "",
    enabled: true,
    conditions: [{ type: "taskType", value: "cron" }],
    model: firstModel,
  };
}

/** Minimal select element with consistent styling */
function StyledSelect({
  value,
  onChange,
  children,
  id,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border/60 bg-card px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
    >
      {children}
    </select>
  );
}

/** Inline label + input row */
function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export const RuleEditor = memo(function RuleEditor({
  open,
  onOpenChange,
  rule,
  models,
  agentIds,
  onSave,
  saving,
}: RuleEditorProps) {
  const isNew = !rule;
  const [draft, setDraft] = useState<RoutingRule>(() =>
    rule ?? makeDefaultRule(models),
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);



  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value;
      setDraft((d) => ({ ...d, name }));
      if (name.trim()) setNameError(null);
    },
    [],
  );

  const handleModelChange = useCallback((model: string) => {
    setDraft((d) => ({ ...d, model }));
    if (model) setModelError(null);
  }, []);

  // Task type condition
  const taskTypeCondition = draft.conditions.find(
    (c): c is { type: "taskType"; value: TaskTypeConditionValue } =>
      c.type === "taskType",
  );
  const agentCondition = draft.conditions.find(
    (c): c is { type: "agentId"; value: string } => c.type === "agentId",
  );

  const handleTaskTypeChange = useCallback((value: string) => {
    const taskTypeValue = value as TaskTypeConditionValue;
    setDraft((d) => {
      const withoutTaskType = d.conditions.filter((c) => c.type !== "taskType");
      const newCondition: RoutingCondition = { type: "taskType", value: taskTypeValue };
      return { ...d, conditions: [newCondition, ...withoutTaskType] };
    });
  }, []);

  const handleAgentChange = useCallback((value: string) => {
    setDraft((d) => {
      const withoutAgent = d.conditions.filter((c) => c.type !== "agentId");
      if (!value || value === "_all") {
        return { ...d, conditions: withoutAgent };
      }
      const newCondition: RoutingCondition = { type: "agentId", value };
      return { ...d, conditions: [...withoutAgent, newCondition] };
    });
  }, []);

  const handleSave = useCallback(async () => {
    let valid = true;
    if (!draft.name.trim()) {
      setNameError("Name is required.");
      valid = false;
    }
    if (!draft.model) {
      setModelError("Target model is required.");
      valid = false;
    }
    if (!valid) return;

    const rule: RoutingRule = {
      ...draft,
      name: draft.name.trim(),
      id: draft.id || generateId(),
    };
    await onSave(rule);
    onOpenChange(false);
  }, [draft, onSave, onOpenChange]);

  const modelKey = (m: GatewayModelChoice) => `${m.provider}/${m.id}`;

  return (
    <SideSheet open={open} onOpenChange={onOpenChange}>
      <SideSheetContent>
        <SideSheetHeader>
          <SideSheetTitle className="text-sm font-semibold text-foreground">
            {isNew ? "New routing rule" : "Edit routing rule"}
          </SideSheetTitle>
          <SideSheetClose>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SideSheetClose>
        </SideSheetHeader>

        <SideSheetBody>
          <div className="flex flex-col gap-5">
            {/* Rule name */}
            <FormField label="Rule name" htmlFor="rule-name">
              <input
                id="rule-name"
                type="text"
                value={draft.name}
                onChange={handleNameChange}
                placeholder="e.g. Cheap model for cron jobs"
                className="w-full rounded-md border border-border/60 bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                autoComplete="off"
                autoFocus
              />
              {nameError && (
                <p className="text-[11px] text-destructive">{nameError}</p>
              )}
            </FormField>

            {/* Task type condition */}
            <FormField label="When task type is" htmlFor="task-type">
              <StyledSelect
                id="task-type"
                value={taskTypeCondition?.value ?? "any"}
                onChange={handleTaskTypeChange}
              >
                {TASK_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </StyledSelect>
            </FormField>

            {/* Agent condition (optional) */}
            <FormField label="Limit to agent (optional)" htmlFor="agent-filter">
              <StyledSelect
                id="agent-filter"
                value={agentCondition?.value ?? "_all"}
                onChange={handleAgentChange}
              >
                <option value="_all">All agents</option>
                {agentIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </StyledSelect>
            </FormField>

            {/* Target model */}
            <FormField label="Route to model" htmlFor="target-model">
              <StyledSelect
                id="target-model"
                value={draft.model}
                onChange={handleModelChange}
              >
                <option value="">— Select a model —</option>
                {models.map((m) => (
                  <option key={modelKey(m)} value={modelKey(m)}>
                    {m.name} ({m.provider})
                  </option>
                ))}
              </StyledSelect>
              {modelError && (
                <p className="text-[11px] text-destructive">{modelError}</p>
              )}
            </FormField>

            {/* Enabled toggle row */}
            <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2.5">
              <span className="text-[13px] text-foreground">Rule enabled</span>
              <button
                type="button"
                role="switch"
                aria-checked={draft.enabled}
                aria-label={draft.enabled ? "Disable rule" : "Enable rule"}
                onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${draft.enabled ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${draft.enabled ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {/* Explanation */}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              When conditions match, the gateway will route this task to the
              selected model instead of the agent&apos;s default. Rules are
              evaluated top-to-bottom; the first match wins.
            </p>
          </div>
        </SideSheetBody>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/30 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Saving…" : (
              <>
                <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {isNew ? "Add rule" : "Save changes"}
              </>
            )}
          </Button>
        </div>
      </SideSheetContent>
    </SideSheet>
  );
});
