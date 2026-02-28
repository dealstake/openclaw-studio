"use client";

import React, { useCallback } from "react";
import { Play, Pause, Archive, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { BaseCard, CardHeader, CardTitle, CardMeta } from "@/components/ui/BaseCard";
import { cn } from "@/lib/utils";
import type { PersonaListItem } from "../hooks/usePersonas";
import type { PersonaStatus, PersonaCategory } from "../lib/personaTypes";

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const STATUS_BADGES: Record<PersonaStatus, { label: string; cls: string }> = {
  draft: {
    label: "Draft",
    cls: "bg-muted text-muted-foreground",
  },
  configuring: {
    label: "Configuring",
    cls: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20",
  },
  active: {
    label: "Active",
    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20",
  },
  paused: {
    label: "Paused",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20",
  },
  archived: {
    label: "Archived",
    cls: "bg-muted text-muted-foreground/60",
  },
};

const CATEGORY_LABELS: Record<PersonaCategory, string> = {
  sales: "Sales",
  admin: "Admin",
  support: "Support",
  marketing: "Marketing",
  hr: "HR",
  finance: "Finance",
  legal: "Legal",
  operations: "Ops",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PersonaCardProps {
  persona: PersonaListItem;
  onSelect: (persona: PersonaListItem) => void;
  onStatusChange: (personaId: string, status: PersonaStatus) => Promise<void>;
  onDelete: (personaId: string) => Promise<void>;
  busy: boolean;
}

export const PersonaCard = React.memo(function PersonaCard({
  persona,
  onSelect,
  onStatusChange,
  onDelete,
  busy,
}: PersonaCardProps) {
  const badge = STATUS_BADGES[persona.status];
  const { metrics } = persona;

  const handleSelect = useCallback(() => {
    onSelect(persona);
  }, [onSelect, persona]);

  const handleToggleActive = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy) return;
      const next = persona.status === "active" ? "paused" : "active";
      void onStatusChange(persona.personaId, next);
    },
    [busy, onStatusChange, persona.personaId, persona.status],
  );

  const handleArchive = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy) return;
      void onStatusChange(persona.personaId, "archived");
    },
    [busy, onStatusChange, persona.personaId],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy) return;
      void onDelete(persona.personaId);
    },
    [busy, onDelete, persona.personaId],
  );

  const canToggle = persona.status === "active" || persona.status === "paused";
  const canArchive = persona.status !== "archived";

  return (
    <BaseCard
      variant="compact"
      isHoverable
      onClick={handleSelect}
      className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
      aria-label={`${persona.displayName} — ${badge.label}`}
    >
      <CardHeader>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CardTitle as="div">{persona.displayName}</CardTitle>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              badge.cls,
            )}
          >
            {badge.label}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
          {canToggle && (
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={busy}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label={persona.status === "active" ? "Pause persona" : "Activate persona"}
            >
              {persona.status === "active" ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {canArchive && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={busy}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Archive persona"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
          {persona.status === "archived" && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Delete persona"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardHeader>

      <CardMeta>
        <span className="text-[11px] text-muted-foreground">
          {CATEGORY_LABELS[persona.category]}
        </span>
        {persona.templateKey && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-[11px] text-muted-foreground/70">
              {persona.templateKey}
            </span>
          </>
        )}
      </CardMeta>

      {/* Metrics row */}
      {metrics.sessionCount > 0 && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            Score: <span className="font-medium text-foreground">{metrics.averageScore.toFixed(1)}</span>/10
          </span>
          <span>
            Sessions: <span className="font-medium text-foreground">{metrics.sessionCount}</span>
          </span>
          {metrics.trend !== 0 && (
            <span className={cn(
              "flex items-center gap-0.5",
              metrics.trend > 0 ? "text-emerald-500" : "text-red-400",
            )}>
              {metrics.trend > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(metrics.trend).toFixed(1)}
            </span>
          )}
        </div>
      )}
    </BaseCard>
  );
});
