"use client";

import React from "react";
import {
  Phone,
  CalendarCheck,
  Headset,
  Megaphone,
  Users,
  Landmark,
  Scale,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PersonaTemplate } from "../lib/templateTypes";

// ---------------------------------------------------------------------------
// Icon mapping (lucide icon name → component)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  "phone-outgoing": Phone,
  "calendar-check": CalendarCheck,
  headset: Headset,
  megaphone: Megaphone,
  users: Users,
  landmark: Landmark,
  scale: Scale,
  settings: Settings,
};

function TemplateIcon({
  iconKey,
  className,
}: {
  iconKey: string;
  className?: string;
}) {
  const Icon = ICON_MAP[iconKey] ?? Sparkles;
  return <Icon className={className} />;
}

// ---------------------------------------------------------------------------
// Difficulty badge
// ---------------------------------------------------------------------------

const DIFFICULTY_STYLES: Record<
  string,
  { label: string; cls: string }
> = {
  beginner: { label: "Beginner", cls: "text-emerald-500 bg-emerald-500/10" },
  intermediate: {
    label: "Intermediate",
    cls: "text-amber-500 bg-amber-500/10",
  },
  advanced: { label: "Advanced", cls: "text-red-400 bg-red-400/10" },
};

// ---------------------------------------------------------------------------
// TemplateCard
// ---------------------------------------------------------------------------

export interface TemplateCardProps {
  template: PersonaTemplate;
  onSelect: (template: PersonaTemplate) => void;
}

export const TemplateCard = React.memo(function TemplateCard({
  template,
  onSelect,
}: TemplateCardProps) {
  const diff = DIFFICULTY_STYLES[template.difficulty] ?? DIFFICULTY_STYLES.beginner;

  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={cn(
        "group/tpl flex flex-col items-start gap-3 rounded-lg border border-border/30",
        "bg-card/40 p-4 text-left transition-all duration-150",
        "hover:border-primary/40 hover:bg-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        "min-h-[44px]", // touch target
      )}
    >
      <span className="sr-only">Use template: </span>
      {/* Icon + title row */}
      <div className="flex w-full items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            "bg-primary/10 text-primary-text transition-colors",
            "group-hover/tpl:bg-primary/20",
          )}
        >
          <TemplateIcon iconKey={template.icon} className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {template.name}
            </span>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                diff.cls,
              )}
            >
              {diff.label}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {template.description}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex w-full items-center gap-3 text-xs text-muted-foreground/90">
        <span>~{template.estimatedSetupMinutes} min setup</span>
        {template.skillRequirements.length > 0 && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span>
              {template.skillRequirements.length} skill
              {template.skillRequirements.length !== 1 ? "s" : ""}
            </span>
          </>
        )}
        <span className="text-muted-foreground/40">·</span>
        <span>{template.discoveryPhases.length} phases</span>
      </div>

      {/* CTA */}
      <span
        className={cn(
          "mt-auto self-end rounded-md px-3 py-1.5 text-xs font-medium",
          "border border-primary/40 bg-primary/10 text-primary",
          "transition-colors group-hover/tpl:bg-primary/20",
          "min-h-[44px] flex items-center", // touch target
        )}
      >
        Use Template
      </span>
    </button>
  );
});
