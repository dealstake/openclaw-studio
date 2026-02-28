"use client";

import React, { useCallback } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { BaseCard, CardHeader, CardTitle, CardMeta } from "@/components/ui/BaseCard";
import { cn } from "@/lib/utils";
import type { Skill } from "../lib/types";

/* ── Status badge styles ── */

function statusBadge(skill: Skill) {
  if (!skill.enabled)
    return {
      label: "Disabled",
      cls: "bg-muted text-muted-foreground",
    };
  if (skill.blocked)
    return {
      label: "Blocked",
      cls: "bg-amber-500/10 text-amber-500",
    };
  return {
    label: "Ready",
    cls: "bg-emerald-500/10 text-emerald-500",
  };
}

function sourceBadge(source: string) {
  switch (source) {
    case "managed":
      return "ClawHub";
    case "workspace":
      return "Workspace";
    case "extra":
      return "Extra";
    default:
      return "Bundled";
  }
}

/* ── Component ── */

export interface SkillCardProps {
  skill: Skill;
  onToggle: (key: string, enabled: boolean) => Promise<void>;
  onSelect: (skill: Skill) => void;
  busy: boolean;
}

export const SkillCard = React.memo(function SkillCard({
  skill,
  onToggle,
  onSelect,
  busy,
}: SkillCardProps) {
  const badge = statusBadge(skill);
  const needsApiKey =
    skill.envRequirements.some((e) => e.required && !e.hasValue) && !skill.hasApiKey;

  const handleToggleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!busy) void onToggle(skill.key, !skill.enabled);
    },
    [busy, onToggle, skill.key, skill.enabled],
  );

  const handleSelect = useCallback(() => {
    onSelect(skill);
  }, [onSelect, skill]);

  return (
    <BaseCard
      variant="compact"
      isHoverable
      onClick={handleSelect}
      className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
      aria-label={`${skill.name} — ${badge.label}`}
    >
      <CardHeader>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CardTitle as="div">{skill.name}</CardTitle>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              badge.cls,
            )}
          >
            {badge.label}
          </span>
        </div>

        {/* Toggle button */}
        <button
          type="button"
          role="switch"
          aria-checked={skill.enabled}
          aria-label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`}
          disabled={busy}
          onClick={handleToggleClick}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
            "min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
            skill.enabled ? "bg-primary" : "bg-muted",
          )}
        >
          {busy ? (
            <Loader2 className="mx-auto h-3 w-3 animate-spin text-foreground" />
          ) : (
            <span
              className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                skill.enabled ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          )}
        </button>
      </CardHeader>

      <CardMeta>
        <span className="text-[11px] text-muted-foreground line-clamp-1">
          {skill.description || "No description"}
        </span>
      </CardMeta>

      <div className="mt-1 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/70">
          {sourceBadge(skill.source)}
        </span>
        {needsApiKey && (
          <span className="flex items-center gap-1 text-[10px] text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            Needs API Key
          </span>
        )}
      </div>
    </BaseCard>
  );
});
