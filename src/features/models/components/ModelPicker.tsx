"use client";

import { memo, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModelInfo, ProviderSummary } from "@/features/models/lib/types";

interface ModelPickerProps {
  /** Currently selected model full key (e.g. "anthropic/claude-opus-4-6") */
  value: string | null;
  /** Display name for the current value */
  displayName?: string;
  /** Called with the new model full key */
  onChange: (fullKey: string) => void;
  /** All models grouped by provider */
  providers: ProviderSummary[];
  /** All models flat list (used when providers is empty) */
  allModels?: ModelInfo[];
  /** Label shown before the value */
  label?: string;
  /** Disable the picker */
  disabled?: boolean;
}

export const ModelPicker = memo(function ModelPicker({
  value,
  displayName,
  onChange,
  providers,
  allModels,
  label,
  disabled,
}: ModelPickerProps) {
  const currentName = useMemo(() => {
    if (displayName) return displayName;
    if (!value) return "Not set";
    const flat = allModels ?? providers.flatMap((p) => p.models);
    const found = flat.find((m) => m.fullKey === value);
    return found?.name ?? value;
  }, [value, displayName, providers, allModels]);

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      {label && (
        <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className="inline-flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-md border border-border/40 bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="truncate">{currentName}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
          {providers.length > 0 ? (
            providers.map((provider, i) => (
              <DropdownMenuGroup key={provider.name}>
                {i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{provider.displayName}</DropdownMenuLabel>
                {provider.models.map((model) => (
                  <DropdownMenuItem
                    key={model.fullKey}
                    onClick={() => onChange(model.fullKey)}
                    className="min-h-[44px]"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm">
                        {model.name}
                        {model.alias ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({model.alias})
                          </span>
                        ) : null}
                      </span>
                      {model.contextWindow ? (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(model.contextWindow / 1000)}K context
                        </span>
                      ) : null}
                    </div>
                    {model.fullKey === value && (
                      <span className="ml-auto text-xs text-primary">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ))
          ) : (
            (allModels ?? []).map((model) => (
              <DropdownMenuItem
                key={model.fullKey}
                onClick={() => onChange(model.fullKey)}
                className="min-h-[44px]"
              >
                <span className="truncate">{model.name}</span>
                {model.fullKey === value && (
                  <span className="ml-auto text-xs text-primary">✓</span>
                )}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
