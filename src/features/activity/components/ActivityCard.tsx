"use client";

import React, { memo } from "react";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getStatusDotClass, truncateSummary } from "../lib/activityFormatter";
import type { DisplayEvent } from "../lib/activityTypes";

const STATUS_BORDER: Record<string, string> = {
  success: "border-l-2 border-l-green-500/40",
  error: "border-l-2 border-l-red-500/40",
  partial: "border-l-2 border-l-yellow-500/40",
};

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

export const ActivityCard = memo(function ActivityCard({
  event,
  isExpanded,
  onToggle,
}: {
  event: DisplayEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const borderClass = STATUS_BORDER[event.status] ?? "border-l-2 border-l-muted-foreground/40";
  const contentId = `activity-detail-${event.id}`;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={`rounded-lg border border-border/60 bg-card/50 transition hover:bg-muted/30 ${borderClass}`}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-left sm:flex-nowrap"
            aria-expanded={isExpanded}
            aria-controls={contentId}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDotClass(event.status)}`}
            />
            <span className="w-12 shrink-0 text-[10px] text-muted-foreground">
              {event.relativeTime}
            </span>
            <span className="truncate max-w-[100px] rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/80">
              {event.taskName}
            </span>
            {event.projectName && (
              <span className="hidden truncate max-w-[100px] rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                {event.projectName}
              </span>
            )}
            <span className="min-w-0 basis-full truncate text-xs text-foreground sm:basis-auto sm:flex-1">
              {truncateSummary(event.summary)}
            </span>
            <ChevronRight
              className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div id={contentId} className="border-t border-border/40 px-3 py-2 space-y-2">
            <p className="text-xs text-foreground/90 leading-relaxed">
              {event.summary}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {event.meta.phase && (
                <MetaItem label="Phase" value={event.meta.phase} />
              )}
              {event.meta.filesChanged != null && (
                <MetaItem label="Files" value={String(event.meta.filesChanged)} />
              )}
              {event.meta.testsCount != null && (
                <MetaItem label="Tests" value={String(event.meta.testsCount)} />
              )}
              {event.meta.durationMs != null && (
                <MetaItem label="Duration" value={formatDuration(event.meta.durationMs)} />
              )}
              {event.formattedTokens && (
                <MetaItem label="Tokens" value={event.formattedTokens} />
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

const MetaItem = memo(function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="text-[10px]">
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="text-foreground">{value}</span>
    </div>
  );
});
