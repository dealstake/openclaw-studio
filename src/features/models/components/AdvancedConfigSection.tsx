"use client";

/**
 * Advanced Configuration — Collapsible section for sub-agent model,
 * heartbeat model, thinking level, and per-cron-job model overrides.
 */

import { memo } from "react";
import { Settings } from "lucide-react";
import { CollapsibleSection } from "@/features/projects/components/CollapsibleSection";
import { ModelPicker } from "./ModelPicker";
import type {
  CronModelOverride,
  ModelRoles,
  ProviderSummary,
} from "@/features/models/lib/types";

const THINKING_LEVELS = [
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

interface AdvancedConfigSectionProps {
  roles: ModelRoles;
  providers: ProviderSummary[];
  onChangeRole: (role: "subagent" | "heartbeat", modelKey: string) => Promise<void>;
  onChangeThinking: (thinking: string) => Promise<void>;
  onChangeCronModel: (cronId: string, modelKey: string | null) => Promise<void>;
  disabled?: boolean;
}

export const AdvancedConfigSection = memo(function AdvancedConfigSection({
  roles,
  providers,
  onChangeRole,
  onChangeThinking,
  onChangeCronModel,
  disabled,
}: AdvancedConfigSectionProps) {
  return (
    <CollapsibleSection
      id="advanced-config"
      icon={Settings}
      label="Advanced Configuration"
      ariaLabel="Toggle advanced configuration"
    >
      <div className="space-y-4">
        {/* Sub-tasks AI */}
        <ModelPicker
          label="Sub-tasks AI"
          value={roles.subagentModel}
          displayName={roles.subagentModelName}
          providers={providers}
          onChange={(key) => void onChangeRole("subagent", key)}
          disabled={disabled}
        />

        {/* Thinking Level */}
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="shrink-0 text-xs text-muted-foreground">
            Thinking Level
          </span>
          <div className="flex gap-1">
            {THINKING_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                disabled={disabled}
                onClick={() => void onChangeThinking(level.value)}
                className={`min-h-[44px] rounded-md border px-3 py-2 text-xs transition-colors ${
                  roles.subagentThinking === level.value ||
                  (!roles.subagentThinking && level.value === "off")
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 text-muted-foreground hover:bg-muted"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                aria-pressed={
                  roles.subagentThinking === level.value ||
                  (!roles.subagentThinking && level.value === "off")
                }
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>

        {/* Health Check AI */}
        <ModelPicker
          label="Health Check AI"
          value={roles.heartbeatModel}
          displayName={roles.heartbeatModelName}
          providers={providers}
          onChange={(key) => void onChangeRole("heartbeat", key)}
          disabled={disabled}
        />

        {/* Scheduled Tasks */}
        {roles.cronOverrides.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Scheduled Tasks
            </span>
            {roles.cronOverrides.map((cron: CronModelOverride) => (
              <ModelPicker
                key={cron.cronId}
                label={cron.cronName}
                value={cron.model}
                displayName={cron.modelName}
                providers={providers}
                onChange={(key) => void onChangeCronModel(cron.cronId, key)}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
});
