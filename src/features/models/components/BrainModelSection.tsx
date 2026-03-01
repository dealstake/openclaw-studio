"use client";

import { memo } from "react";
import { Brain } from "lucide-react";
import { BaseCard } from "@/components/ui/BaseCard";
import { ModelPicker } from "./ModelPicker";
import type {
  BrainModelConfig,
  ModelInfo,
  ProviderSummary,
} from "@/features/models/lib/types";

interface BrainModelSectionProps {
  config: BrainModelConfig;
  providers: ProviderSummary[];
  allModels: ModelInfo[];
  onChangePrimary: (modelKey: string) => Promise<void>;
  disabled?: boolean;
}

export const BrainModelSection = memo(function BrainModelSection({
  config,
  providers,
  allModels,
  onChangePrimary,
  disabled,
}: BrainModelSectionProps) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Brain className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Primary Brain</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        The main AI that powers your agent.
      </p>
      <BaseCard variant="default" isHoverable={false}>
        <div className="flex flex-col gap-2">
          <ModelPicker
            label="Active"
            value={config.primary}
            displayName={config.primaryName}
            onChange={onChangePrimary}
            providers={providers}
            allModels={allModels}
            disabled={disabled}
          />
          {config.fallbackNames.length > 0 && (
            <div className="flex min-w-0 items-center justify-between gap-4">
              <span className="shrink-0 text-xs text-muted-foreground">
                Backup
              </span>
              <span className="truncate text-sm text-foreground">
                {config.fallbackNames.join(", ")}
              </span>
            </div>
          )}
        </div>
      </BaseCard>
    </section>
  );
});
