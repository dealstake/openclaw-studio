"use client";

import { memo, useCallback, useState } from "react";
import { Settings, Trash2 } from "lucide-react";
import { BaseCard } from "@/components/ui/BaseCard";
import { PanelIconButton } from "@/components/PanelIconButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { SpecialistEngine, EngineType } from "@/features/models/lib/types";

interface SpecialistEngineCardProps {
  engine: SpecialistEngine;
  onConfigure: (engine: SpecialistEngine) => void;
  onRemove: (type: EngineType) => Promise<void>;
}

export const SpecialistEngineCard = memo(function SpecialistEngineCard({
  engine,
  onConfigure,
  onRemove,
}: SpecialistEngineCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const handleRemove = useCallback(async () => {
    await onRemove(engine.type);
    setConfirmOpen(false);
  }, [engine.type, onRemove]);

  return (
    <>
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
              <span className="text-xs text-muted-foreground">
                {statusLabel}
              </span>
            </div>

            <p
              className="text-xs text-muted-foreground line-clamp-1"
              title={engine.purpose}
            >
              {engine.purpose}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Model: {engine.model}</span>
              <span className="font-mono">
                Key:{" "}
                {engine.maskedApiKey ?? (
                  <span className="not-italic text-muted-foreground/70">
                    Not set
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            <PanelIconButton
              aria-label={`Configure ${engine.displayName}`}
              onClick={(e) => {
                e.stopPropagation();
                onConfigure(engine);
              }}
            >
              <Settings className="h-3.5 w-3.5" />
            </PanelIconButton>
            <PanelIconButton
              aria-label={`Remove ${engine.displayName}`}
              onClick={(e) => {
                e.stopPropagation();
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </PanelIconButton>
          </div>
        </div>
      </BaseCard>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remove ${engine.displayName}?`}
        description="This will disable the engine and clear its API key. You can add it back later."
        confirmLabel="Remove"
        destructive
        onConfirm={handleRemove}
      />
    </>
  );
});
