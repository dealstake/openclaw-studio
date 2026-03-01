"use client";

import { memo } from "react";
import { SectionLabel } from "@/components/SectionLabel";
import type { ParsedGatewaySettings } from "../lib/types";

interface ModelDefaultsSectionProps {
  config: ParsedGatewaySettings;
}

export const ModelDefaultsSection = memo(function ModelDefaultsSection({
  config,
}: ModelDefaultsSectionProps) {
  const { modelDefaults } = config;
  const catalogEntries = Object.entries(modelDefaults.catalog);

  return (
    <section aria-label="Model Defaults">
      <SectionLabel as="h4" className="mb-2 text-muted-foreground">
        Model Defaults
      </SectionLabel>

      <div className="rounded-md border border-border/80 bg-card/70 p-4 space-y-4">
        {/* Primary model */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1">
            Primary Model
          </p>
          <p className="text-sm text-foreground font-mono truncate">
            {modelDefaults.primary ?? (
              <span className="text-muted-foreground italic">Not set</span>
            )}
          </p>
        </div>

        {/* Fallback chain */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1">
            Fallback Chain
          </p>
          {modelDefaults.fallbacks.length > 0 ? (
            <ol className="space-y-1">
              {modelDefaults.fallbacks.map((f, i) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <span className="text-[10px] text-muted-foreground w-4 shrink-0">
                    {i + 1}.
                  </span>
                  <span className="font-mono truncate">{f}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              No fallbacks configured
            </p>
          )}
        </div>

        {/* Model catalog */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1">
            Model Catalog ({catalogEntries.length} entries)
          </p>
          {catalogEntries.length > 0 ? (
            <ul className="space-y-1">
              {catalogEntries.map(([key, entry]) => (
                <li
                  key={key}
                  className="rounded-md border border-border/80 bg-card/75 px-3 py-2"
                >
                  <p className="text-sm font-mono text-foreground truncate">
                    {key}
                  </p>
                  {entry.alias && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      alias: {entry.alias}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              No catalog entries
            </p>
          )}
        </div>
      </div>
    </section>
  );
});
