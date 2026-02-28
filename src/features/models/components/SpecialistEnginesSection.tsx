"use client";

import { memo } from "react";
import { Wrench } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SpecialistEngineCard } from "./SpecialistEngineCard";
import type { SpecialistEngine } from "@/features/models/lib/types";

interface SpecialistEnginesSectionProps {
  engines: SpecialistEngine[];
}

export const SpecialistEnginesSection = memo(function SpecialistEnginesSection({
  engines,
}: SpecialistEnginesSectionProps) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">
          Specialist Engines
        </h3>
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
            <SpecialistEngineCard key={engine.configKey} engine={engine} />
          ))}
        </div>
      )}
    </section>
  );
});
