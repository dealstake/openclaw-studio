"use client";

import React, { useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { BaseCard, CardHeader, CardTitle, CardMeta } from "@/components/ui/BaseCard";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
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
      cls: "bg-amber-500/10 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-500/20",
    };
  return {
    label: "Ready",
    cls: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-500/20",
  };
}

function sourceBadge(source: string): { label: string; cls: string } {
  switch (source) {
    case "managed":
      return { label: "ClawHub", cls: "bg-primary/10 text-primary border border-primary/20" };
    case "workspace":
      return { label: "Workspace", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20" };
    case "extra":
      return { label: "Extra", cls: "bg-muted text-muted-foreground" };
    default:
      return { label: "Bundled", cls: "bg-muted text-muted-foreground" };
  }
}

/* ── Component ── */

export interface SkillCardProps {
  skill: Skill;
  onToggle: (key: string, enabled: boolean) => Promise<void>;
  onSelect: (skill: Skill) => void;
  onSetupCredential?: (skill: Skill) => void;
  busy: boolean;
}

export const SkillCard = React.memo(function SkillCard({
  skill,
  onToggle,
  onSelect,
  onSetupCredential,
  busy,
}: SkillCardProps) {
  const badge = statusBadge(skill);
  const needsApiKey =
    skill.envRequirements.some((e) => e.required && !e.hasValue) && !skill.hasApiKey;

  const handleToggleClick = useCallback(() => {
    if (!busy) void onToggle(skill.key, !skill.enabled);
  }, [busy, onToggle, skill.key, skill.enabled]);

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
        <ToggleSwitch
          checked={skill.enabled}
          onChange={handleToggleClick}
          disabled={busy}
          loading={busy}
          label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`}
        />
      </CardHeader>

      <CardMeta>
        <span className="text-[11px] text-muted-foreground line-clamp-1">
          {skill.description || "No description"}
        </span>
      </CardMeta>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            sourceBadge(skill.source).cls,
          )}
        >
          {sourceBadge(skill.source).label}
        </span>
        {needsApiKey && (
          onSetupCredential ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetupCredential(skill);
              }}
              className="flex items-center gap-1 rounded-sm px-2 py-1 min-h-[44px] text-xs text-amber-600 dark:text-amber-400 underline decoration-amber-600/70 transition-colors hover:text-amber-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
              aria-label={`Set up API key for ${skill.name}`}
            >
              <AlertTriangle className="h-3 w-3" />
              Set up API Key
            </button>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              Needs API Key
            </span>
          )
        )}
      </div>
    </BaseCard>
  );
});
