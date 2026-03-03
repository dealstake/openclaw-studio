"use client";

import React, { useMemo } from "react";
import { Plus } from "lucide-react";
import { BaseCard, CardTitle } from "@/components/ui/BaseCard";
import type { CredentialTemplate } from "../lib/types";
import { CATEGORY_LABELS } from "../lib/types";
import { CREDENTIAL_TEMPLATES } from "../lib/templates";

export interface TemplateGridProps {
  onSelectTemplate: (template: CredentialTemplate) => void;
  onSelectCustom: () => void;
  search: string;
}

export const TemplateGrid = React.memo(function TemplateGrid({
  onSelectTemplate,
  onSelectCustom,
  search,
}: TemplateGridProps) {
  const filtered = useMemo(() => {
    if (!search.trim()) return CREDENTIAL_TEMPLATES;
    const q = search.toLowerCase();
    return CREDENTIAL_TEMPLATES.filter(
      (t) =>
        t.serviceName.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {filtered.length === 0 && search.trim() !== "" && (
        <div className="col-span-full pb-2 text-center text-xs text-muted-foreground">
          No templates match &ldquo;{search}&rdquo;
        </div>
      )}
      {filtered.map((template) => (
        <BaseCard
          key={template.key}
          variant="compact"
          isHoverable
          onClick={() => onSelectTemplate(template)}
          className="min-h-[44px]"
        >
          <CardTitle as="div" className="text-xs">
            {template.serviceName}
          </CardTitle>
          <span className="mt-0.5 text-xs text-muted-foreground/60">
            {CATEGORY_LABELS[template.category]}
          </span>
        </BaseCard>
      ))}

      {/* Custom credential option */}
      <BaseCard
        variant="compact"
        isHoverable
        onClick={onSelectCustom}
        className="min-h-[44px] border-dashed"
      >
        <div className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
          <CardTitle as="div" className="text-xs">
            Custom
          </CardTitle>
        </div>
        <span className="mt-0.5 text-xs text-muted-foreground/60">
          Any service
        </span>
      </BaseCard>
    </div>
  );
});
