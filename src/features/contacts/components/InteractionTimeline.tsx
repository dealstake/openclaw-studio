"use client";

import { memo } from "react";
import {
  Phone,
  Mail,
  CalendarDays,
  StickyNote,
  CheckSquare,
  ThumbsUp,
  ThumbsDown,
  Minus,
  VoicemailIcon,
  ExternalLink,
} from "lucide-react";
import type { ClientInteractionRow } from "../hooks/useContacts";

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, typeof Phone> = {
  call:    Phone,
  email:   Mail,
  meeting: CalendarDays,
  note:    StickyNote,
  task:    CheckSquare,
};

const TYPE_LABEL: Record<string, string> = {
  call:    "Call",
  email:   "Email",
  meeting: "Meeting",
  note:    "Note",
  task:    "Task",
};

const TYPE_COLOR: Record<string, string> = {
  call:    "text-blue-500 dark:text-blue-400",
  email:   "text-violet-500 dark:text-violet-400",
  meeting: "text-amber-500 dark:text-amber-400",
  note:    "text-slate-500 dark:text-slate-400",
  task:    "text-emerald-500 dark:text-emerald-400",
};

const OUTCOME_CONFIG: Record<string, { icon: typeof ThumbsUp; color: string; label: string }> = {
  positive:  { icon: ThumbsUp,   color: "text-emerald-500", label: "Positive"  },
  negative:  { icon: ThumbsDown, color: "text-red-500",     label: "Negative"  },
  neutral:   { icon: Minus,      color: "text-slate-400",   label: "Neutral"   },
  "no-answer": { icon: VoicemailIcon, color: "text-amber-500", label: "No Answer" },
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
}

// ─── Single entry ─────────────────────────────────────────────────────────────

const InteractionEntry = memo(function InteractionEntry({
  interaction,
  isLast,
}: {
  interaction: ClientInteractionRow;
  isLast: boolean;
}) {
  const Icon = TYPE_ICON[interaction.type] ?? StickyNote;
  const iconColor = TYPE_COLOR[interaction.type] ?? "text-muted-foreground";
  const typeLabel = TYPE_LABEL[interaction.type] ?? interaction.type;
  const outcomeCfg = interaction.outcome ? (OUTCOME_CONFIG[interaction.outcome] ?? null) : null;

  return (
    <div className="relative flex gap-3">
      {/* Vertical connector line */}
      {!isLast && (
        <div
          className="absolute left-[15px] top-7 h-full w-px bg-border/40"
          aria-hidden="true"
        />
      )}

      {/* Icon node */}
      <div
        className={`mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-border/60 bg-card ${iconColor}`}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-medium text-foreground">{typeLabel}</span>
          {interaction.channel && (
            <span className="text-[10px] text-muted-foreground">
              via {interaction.channel}
            </span>
          )}
          {outcomeCfg && (
            <span
              className={`ml-auto flex shrink-0 items-center gap-0.5 text-[10px] font-medium ${outcomeCfg.color}`}
              title={`Outcome: ${outcomeCfg.label}`}
            >
              <outcomeCfg.icon className="h-3 w-3" />
              {outcomeCfg.label}
            </span>
          )}
        </div>

        {interaction.summary && (
          <p className="mt-0.5 text-[11px] text-foreground/80 line-clamp-3">
            {interaction.summary}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{formatTimestamp(interaction.createdAt)}</span>
          {interaction.personaId && (
            <span className="truncate">· {interaction.personaId}</span>
          )}
          {interaction.artifactLink && (
            <a
              href={interaction.artifactLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-0.5 text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Artifact
            </a>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── InteractionTimeline ──────────────────────────────────────────────────────

export interface InteractionTimelineProps {
  interactions: ClientInteractionRow[];
  /** Show skeleton placeholders */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Show empty state when no interactions */
  emptyLabel?: string;
}

export const InteractionTimeline = memo(function InteractionTimeline({
  interactions,
  loading = false,
  error = null,
  emptyLabel = "No interactions yet",
}: InteractionTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-3 py-2" aria-label="Loading interactions" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-[30px] w-[30px] shrink-0 animate-pulse rounded-full bg-muted/50" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
              <div className="h-2.5 w-full animate-pulse rounded bg-muted/40" />
              <div className="h-2.5 w-2/3 animate-pulse rounded bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-4 text-center text-xs text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (interactions.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <div role="log" aria-label="Interaction history">
      {interactions.map((interaction, idx) => (
        <InteractionEntry
          key={interaction.id}
          interaction={interaction}
          isLast={idx === interactions.length - 1}
        />
      ))}
    </div>
  );
});
