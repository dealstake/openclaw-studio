"use client";

import { memo } from "react";
import { BaseCard } from "@/components/ui/BaseCard";
import type { SpecialistEngine } from "@/features/models/lib/types";

interface SpecialistEngineCardProps {
  engine: SpecialistEngine;
}

export const SpecialistEngineCard = memo(function SpecialistEngineCard({
  engine,
}: SpecialistEngineCardProps) {
  const statusColor =
    engine.enabled && engine.hasApiKey
      ? "bg-emerald-500"
      : engine.enabled
        ? "bg-amber-500"
        : "bg-red-500";

  const statusLabel =
    engine.enabled && engine.hasApiKey
      ? "Active"
      : engine.enabled
        ? "Key missing"
        : "Disabled";

  return (
    <BaseCard variant="compact" isHoverable={false}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="mt-0.5 text-lg leading-none" aria-hidden>
          {engine.type === "gemini" ? "♊" : "🤖"}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {engine.displayName}
            </span>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`}
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground" role="status">
              {statusLabel}
            </span>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-1">
            {engine.purpose}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Model: {engine.model}</span>
            <span className="font-mono">Key: {engine.maskedApiKey}</span>
          </div>
        </div>
      </div>
    </BaseCard>
  );
});
