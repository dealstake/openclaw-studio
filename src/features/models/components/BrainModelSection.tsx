"use client";

import { memo } from "react";
import { Brain } from "lucide-react";
import { BaseCard } from "@/components/ui/BaseCard";
import type { BrainModelConfig } from "@/features/models/lib/types";

interface BrainModelSectionProps {
  config: BrainModelConfig;
}

export const BrainModelSection = memo(function BrainModelSection({
  config,
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
          <div className="flex min-w-0 items-center justify-between gap-4">
            <span className="shrink-0 text-xs text-muted-foreground">Active</span>
            <span className="truncate text-sm font-medium text-foreground">
              {config.primaryName}
            </span>
          </div>
          {config.fallbackNames.length > 0 && (
            <div className="flex min-w-0 items-center justify-between gap-4">
              <span className="shrink-0 text-xs text-muted-foreground">Backup</span>
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
