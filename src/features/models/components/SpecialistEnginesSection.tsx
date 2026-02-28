"use client";

import { memo, useCallback, useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SpecialistEngineCard } from "./SpecialistEngineCard";
import { AddEngineDialog } from "./AddEngineDialog";
import type { EngineType, SpecialistEngine } from "@/features/models/lib/types";

interface SpecialistEnginesSectionProps {
  engines: SpecialistEngine[];
  onSaveEngine: (
    type: EngineType,
    apiKey: string,
    model: string,
    fallbackModel: string | null,
  ) => Promise<void>;
  onRemoveEngine: (type: EngineType) => Promise<void>;
}

export const SpecialistEnginesSection = memo(function SpecialistEnginesSection({
  engines,
  onSaveEngine,
  onRemoveEngine,
}: SpecialistEnginesSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEngine, setEditEngine] = useState<SpecialistEngine | null>(null);

  const handleConfigure = useCallback((engine: SpecialistEngine) => {
    setEditEngine(engine);
    setDialogOpen(true);
  }, []);

  const handleAdd = useCallback(() => {
    setEditEngine(null);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setTimeout(() => setEditEngine(null), 200);
    }
  }, []);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            Specialist Engines
          </h3>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Engine
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Extra AIs your agent calls for specialized tasks.
      </p>

      {engines.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No specialist engines configured"
          description="Add one to give your agent extra capabilities."
          className="py-6"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {engines.map((engine) => (
            <SpecialistEngineCard
              key={engine.configKey}
              engine={engine}
              onConfigure={handleConfigure}
              onRemove={onRemoveEngine}
            />
          ))}
        </div>
      )}

      <AddEngineDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        existingEngines={engines}
        onSave={onSaveEngine}
        editEngine={editEngine}
      />
    </section>
  );
});
