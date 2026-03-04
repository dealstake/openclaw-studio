"use client";

import { memo } from "react";
import { Building2, Mail, Phone, Clock } from "lucide-react";
import { parseTags, type ClientContactRow } from "../hooks/useContacts";

// ─── Pipeline stage config ─────────────────────────────────────────────────────

export const PIPELINE_STAGES = ["lead", "contacted", "qualified", "meeting", "closed"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const STAGE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  lead:       { label: "Lead",       bg: "bg-slate-100 dark:bg-slate-800",   text: "text-slate-600 dark:text-slate-300" },
  contacted:  { label: "Contacted",  bg: "bg-blue-100 dark:bg-blue-900/40",  text: "text-blue-700 dark:text-blue-300"  },
  qualified:  { label: "Qualified",  bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300" },
  meeting:    { label: "Meeting",    bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  closed:     { label: "Closed",     bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
};

export function stageBadge(stage: string | null) {
  const cfg = stage ? (STAGE_CONFIG[stage] ?? null) : null;
  return cfg;
}

/** Format ISO date string to "2d ago", "Jan 15", etc. */
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / 3_600_000);
    if (diffHours === 0) {
      const diffMin = Math.floor(diffMs / 60_000);
      return diffMin <= 1 ? "just now" : `${diffMin}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── ContactCard ──────────────────────────────────────────────────────────────

export interface ContactCardProps {
  contact: ClientContactRow;
  /** Timestamp of the most recent interaction (ISO string), if known */
  lastInteractionAt?: string | null;
  onClick: (id: string) => void;
}

export const ContactCard = memo(function ContactCard({
  contact,
  lastInteractionAt,
  onClick,
}: ContactCardProps) {
  const badge = stageBadge(contact.stage);

  const tags = parseTags(contact.tags);

  // Initials avatar
  const initials = contact.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <button
      type="button"
      onClick={() => onClick(contact.id)}
      className="group w-full rounded-lg border border-border/40 bg-card px-3 py-2.5 text-left transition-all hover:border-border hover:bg-muted/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      aria-label={`${contact.name} — ${contact.company ?? "No company"}, ${contact.stage ?? "No stage"}`}
    >
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary"
          aria-hidden="true"
        >
          {initials || "?"}
        </div>

        <div className="min-w-0 flex-1">
          {/* Name + stage badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-medium text-foreground transition-colors group-hover:text-primary truncate">
              {contact.name}
            </span>
            {badge && (
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badge.bg} ${badge.text}`}
              >
                {badge.label}
              </span>
            )}
          </div>

          {/* Company / title */}
          {(contact.company || contact.title) && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              {contact.company && (
                <>
                  <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{contact.company}</span>
                  {contact.title && <span className="shrink-0">· {contact.title}</span>}
                </>
              )}
              {!contact.company && contact.title && <span className="truncate">{contact.title}</span>}
            </div>
          )}

          {/* Contact info row */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
            {contact.email && (
              <span className="flex items-center gap-0.5 truncate">
                <Mail className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[120px]">{contact.email}</span>
              </span>
            )}
            {contact.phone && (
              <span className="flex items-center gap-0.5">
                <Phone className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                {contact.phone}
              </span>
            )}
            {lastInteractionAt && (
              <span className="flex items-center gap-0.5 ml-auto shrink-0">
                <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                {formatRelativeTime(lastInteractionAt)}
              </span>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 4 && (
                <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  +{tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
});
