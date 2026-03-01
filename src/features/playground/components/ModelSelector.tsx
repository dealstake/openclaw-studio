"use client";

import { memo, useId } from "react";
import { ChevronDown } from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { sectionLabelClass } from "@/components/SectionLabel";

interface ModelSelectorProps {
  models: GatewayModelChoice[];
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  className?: string;
}

export const ModelSelector = memo(function ModelSelector({
  models,
  value,
  onChange,
  disabled = false,
  className = "",
}: ModelSelectorProps) {
  const id = useId();

  // Group by provider for a cleaner select experience
  const providers = Array.from(new Set(models.map((m) => m.provider))).sort();
  const byProvider = providers.map((p) => ({
    provider: p,
    models: models.filter((m) => m.provider === p),
  }));

  const noModels = models.length === 0;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className={`${sectionLabelClass} text-muted-foreground`}>
        Model
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || noModels}
          className={`w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-xs text-foreground
            transition-colors focus:outline-none focus:ring-1 focus:ring-primary/50
            disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {noModels && (
            <option value="">No models available</option>
          )}
          {byProvider.map(({ provider, models: providerModels }) => (
            <optgroup key={provider} label={provider}>
              {providerModels.map((m) => {
                const key = `${m.provider}/${m.id}`;
                const ctxLabel = m.contextWindow
                  ? ` (${(m.contextWindow / 1000).toFixed(0)}K ctx)`
                  : "";
                return (
                  <option key={key} value={key}>
                    {m.name || m.id}{ctxLabel}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
});
