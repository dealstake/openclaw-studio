"use client";

/**
 * Model Catalog — Expandable list of all available models grouped by provider.
 */

import { memo } from "react";
import { Library } from "lucide-react";
import { CollapsibleSection } from "@/features/projects/components/CollapsibleSection";
import type { ProviderSummary } from "@/features/models/lib/types";

interface ModelCatalogSectionProps {
  providers: ProviderSummary[];
}

export const ModelCatalogSection = memo(function ModelCatalogSection({
  providers,
}: ModelCatalogSectionProps) {
  if (providers.length === 0) return null;

  const totalModels = providers.reduce((sum, p) => sum + p.modelCount, 0);

  return (
    <CollapsibleSection
      id="model-catalog"
      icon={Library}
      label={`${totalModels} Available Models`}
      ariaLabel="Toggle available models list"
    >
      <div className="space-y-3">
        {providers.map((provider) => (
          <div key={provider.name}>
            <h4 className="mb-1.5 text-xs font-semibold text-foreground">
              {provider.displayName}
              <span className="ml-1.5 font-normal text-muted-foreground">
                ({provider.modelCount})
              </span>
            </h4>
            <div className="space-y-0.5">
              {provider.models.map((model) => (
                <div
                  key={model.fullKey}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
                >
                  {/* Status indicators */}
                  {model.isDefault && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="Primary brain" />
                  )}
                  {model.isFallback && !model.isDefault && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-500" title="Fallback" />
                  )}
                  {!model.isDefault && !model.isFallback && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-border" />
                  )}

                  <span className="min-w-0 truncate text-foreground">
                    {model.name}
                  </span>
                  {model.isDefault && <span className="sr-only">(Primary brain)</span>}
                  {model.isFallback && !model.isDefault && <span className="sr-only">(Fallback)</span>}

                  {model.alias && (
                    <span className="shrink-0 text-muted-foreground">
                      ({model.alias})
                    </span>
                  )}

                  {model.contextWindow ? (
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {Math.round(model.contextWindow / 1000)}K
                    </span>
                  ) : null}

                  {model.reasoning && (
                    <span className="shrink-0 text-muted-foreground" title="Reasoning capable">
                      🧠
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
});
