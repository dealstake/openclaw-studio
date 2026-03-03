"use client";

import React, { useCallback } from "react";
import {
  Play,
  Pause,
  Archive,
  Trash2,
  TrendingUp,
  TrendingDown,
  Dumbbell,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Loader2,
  Rocket,
} from "lucide-react";
import { BaseCard, CardHeader, CardTitle, CardMeta } from "@/components/ui/BaseCard";
import { cn } from "@/lib/utils";
import type { PersonaListItem } from "../hooks/usePersonas";
import type { PersonaStatus, PersonaCategory } from "../lib/personaTypes";
import type { OverallPreflightStatus } from "../lib/preflightTypes";

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const STATUS_BADGES: Record<PersonaStatus, { label: string; cls: string }> = {
  draft: {
    label: "Draft",
    cls: "bg-muted text-foreground",
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
// Health status icon component
// ---------------------------------------------------------------------------

/** Maps overall preflight status to icon + colour */
const HEALTH_STATUS_META: Record<
  OverallPreflightStatus | "checking",
  { Icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>; cls: string; label: string }
> = {
  ready: {
    Icon: ShieldCheck,
    cls: "text-emerald-500 dark:text-emerald-400",
    label: "All systems ready",
  },
  action_needed: {
    Icon: ShieldAlert,
    cls: "text-amber-500 dark:text-amber-400",
    label: "Some setup needed",
  },
  blocked: {
    Icon: ShieldAlert,
    cls: "text-red-500 dark:text-red-400",
    label: "Required setup missing",
  },
  checking: {
    Icon: Loader2,
    cls: "text-muted-foreground animate-spin",
    label: "Checking…",
  },
};

const HealthStatusIcon = React.memo(function HealthStatusIcon({
  status,
}: {
  status: OverallPreflightStatus | "checking";
}) {
  const meta = HEALTH_STATUS_META[status];
  const { Icon, cls, label } = meta;
  return (
    <span title={label} aria-label={label} className="shrink-0">
      <Icon className={cn("h-3 w-3", cls)} />
    </span>
  );
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PersonaCardProps {
  persona: PersonaListItem;
  onSelect: (persona: PersonaListItem) => void;
  onPractice?: (persona: PersonaListItem) => void;
  onKnowledge?: (persona: PersonaListItem) => void;
  onStatusChange: (personaId: string, status: PersonaStatus) => Promise<void>;
  onDelete: (personaId: string) => Promise<void>;
  busy: boolean;
  /** Run a health-check preflight for this persona. */
  onHealthCheck?: (persona: PersonaListItem) => void;
  /**
   * Last known health status for this persona.
   * Displayed as a small icon badge on the card.
   */
  healthStatus?: OverallPreflightStatus | "checking";
}

export const PersonaCard = React.memo(function PersonaCard({
  persona,
  onSelect,
  onPractice,
  onKnowledge,
  onStatusChange,
  onDelete,
  busy,
  onHealthCheck,
  healthStatus,
}: PersonaCardProps) {
  const badge = STATUS_BADGES[persona.status];
  const { metrics } = persona;

  const handleSelect = useCallback(() => {
    onSelect(persona);
  }, [onSelect, persona]);

  const handlePractice = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPractice?.(persona);
    },
    [onPractice, persona],
  );

  const handleToggleActive = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy) return;
      // draft/configuring → active (activate), active → paused, paused → active
      const next: PersonaStatus =
        persona.status === "active" ? "paused" : "active";
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
      if (!window.confirm(`Delete "${persona.displayName}"? This cannot be undone.`)) return;
      void onDelete(persona.personaId);
    },
    [busy, onDelete, persona.personaId, persona.displayName],
  );

  const handleKnowledge = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onKnowledge?.(persona);
    },
    [onKnowledge, persona],
  );

  const handleHealthCheck = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onHealthCheck?.(persona);
    },
    [onHealthCheck, persona],
  );

  const canToggle = persona.status === "active" || persona.status === "paused";
  const canArchive = persona.status !== "archived";
  const canPractice = onPractice && (persona.status === "active" || persona.status === "draft");
  const canKnowledge = onKnowledge && persona.status !== "archived";
  const canHealthCheck =
    onHealthCheck && persona.status !== "archived" && healthStatus !== "checking";

  return (
    <BaseCard
      variant="compact"
      isHoverable
      onClick={handleSelect}
      className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
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
          {/* Health status icon — shown when a result exists */}
          {healthStatus && <HealthStatusIcon status={healthStatus} />}
        </div>

        {/* Activate button — visible for draft/configuring personas not yet registered as gateway agents */}
        {(persona.status === "draft" || persona.status === "configuring") && (
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={busy}
            className="rounded px-2 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-colors min-h-[44px] flex items-center justify-center gap-1"
            aria-label="Activate persona"
          >
            <Rocket className="h-3.5 w-3.5" />
            Activate
          </button>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-100 md:opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
          {/* Health check button */}
          {(canHealthCheck || healthStatus === "checking") && (
            <button
              type="button"
              onClick={handleHealthCheck}
              disabled={healthStatus === "checking"}
              className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Run health check"
              title="Run health check"
            >
              {healthStatus === "checking" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Shield className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {canPractice && (
            <button
              type="button"
              onClick={handlePractice}
              className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Practice with persona"
            >
              <Dumbbell className="h-3.5 w-3.5" />
            </button>
          )}
          {canKnowledge && (
            <button
              type="button"
              onClick={handleKnowledge}
              className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Manage knowledge"
            >
              <BookOpen className="h-3.5 w-3.5" />
            </button>
          )}
          {canToggle && (
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={busy}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Delete persona"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardHeader>

      <CardMeta>
        <span className="text-xs text-muted-foreground">
          {CATEGORY_LABELS[persona.category]}
        </span>
        {persona.templateKey && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-xs text-muted-foreground/70">
              {persona.templateKey}
            </span>
          </>
        )}
      </CardMeta>

      {/* Metrics row */}
      {metrics.sessionCount > 0 && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Score:{" "}
            <span className="font-medium text-foreground">
              {metrics.averageScore.toFixed(1)}
            </span>
            /10
          </span>
          <span>
            Sessions:{" "}
            <span className="font-medium text-foreground">{metrics.sessionCount}</span>
          </span>
          {metrics.trend !== 0 && (
            <span
              className={cn(
                "flex items-center gap-0.5",
                metrics.trend > 0 ? "text-emerald-500" : "text-red-400",
              )}
            >
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
