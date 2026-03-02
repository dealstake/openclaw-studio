"use client";

import { memo } from "react";
import { CheckCheck, Layers, Hand } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import {
  AUTONOMY_LEVELS,
  AUTONOMY_LEVEL_LABELS,
  AUTONOMY_LEVEL_DESCRIPTIONS,
  type AutonomyLevel,
} from "@/features/agents/lib/autonomyService";

// ── Icon map ─────────────────────────────────────────────────────────────────

const AUTONOMY_ICONS: Record<AutonomyLevel, typeof CheckCheck> = {
  manual: Hand,
  plan: Layers,
  autonomous: CheckCheck,
};

// ── Option card ───────────────────────────────────────────────────────────────

const AutonomyOption = memo(function AutonomyOption({
  level,
  selected,
  onSelect,
}: {
  level: AutonomyLevel;
  selected: boolean;
  onSelect: (level: AutonomyLevel) => void;
}) {
  const Icon = AUTONOMY_ICONS[level];
  const label = AUTONOMY_LEVEL_LABELS[level];
  const description = AUTONOMY_LEVEL_DESCRIPTIONS[level];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(level)}
      className={[
        "flex flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-border/80 bg-card/75 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
      ].join(" ")}
      data-testid={`autonomy-option-${level}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
          aria-hidden="true"
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className="text-[10px] leading-tight text-muted-foreground">{description}</p>
    </button>
  );
});

// ── Badge (session header indicator) ─────────────────────────────────────────

const AUTONOMY_BADGE_COLORS: Record<AutonomyLevel, string> = {
  manual: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  plan: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  autonomous: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300",
};

/**
 * Compact pill badge showing the active autonomy level.
 * Rendered in the session header area of the chat panel.
 * Only visible (non-default) levels use an accent colour; autonomous
 * uses a subtle emerald to confirm the setting without distracting.
 */
export const AutonomyLevelBadge = memo(function AutonomyLevelBadge({
  level,
  onClick,
}: {
  level: AutonomyLevel;
  onClick?: () => void;
}) {
  const Icon = AUTONOMY_ICONS[level];
  const label = AUTONOMY_LEVEL_LABELS[level];
  const colorClass = AUTONOMY_BADGE_COLORS[level];

  const content = (
    <>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </>
  );

  const baseClass = `flex items-center gap-1 rounded-full border px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.08em] ${colorClass}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} cursor-pointer transition hover:opacity-80`}
        aria-label={`Autonomy: ${label}. Click to change.`}
        title={`Autonomy: ${label}. Click to change.`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={`${baseClass} cursor-default`}
      title={`Autonomy: ${label}`}
    >
      {content}
    </span>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

type AutonomyLevelSelectorProps = {
  value: AutonomyLevel;
  onChange: (level: AutonomyLevel) => void;
};

export const AutonomyLevelSelector = memo(function AutonomyLevelSelector({
  value,
  onChange,
}: AutonomyLevelSelectorProps) {
  return (
    <section
      className="rounded-md border border-border/80 bg-card/70 p-4"
      data-testid="autonomy-level-selector"
    >
      <SectionLabel>Autonomy</SectionLabel>
      <div
        className="mt-3 grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label="Agent autonomy level"
      >
        {AUTONOMY_LEVELS.map((level) => (
          <AutonomyOption
            key={level}
            level={level}
            selected={value === level}
            onSelect={onChange}
          />
        ))}
      </div>
    </section>
  );
});
