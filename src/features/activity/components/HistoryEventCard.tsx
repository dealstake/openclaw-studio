"use client";

import { memo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import type { ActivityEvent } from "@/features/activity/lib/activityTypes";
import { taskIcon, STATUS_PILL, formatHistoryTime } from "@/features/activity/lib/activityDisplayUtils";

/** Card for a completed activity history event */
export const HistoryEventCard = memo(function HistoryEventCard({
  event,
}: {
  event: ActivityEvent;
}) {
  const [expanded, setExpanded] = useState(false);
  const pill = STATUS_PILL[event.status] ?? STATUS_PILL.success;
  const hasSummary = !!event.summary?.trim();

  return (
    <div className="group rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
      <div className="flex gap-2.5">
        <div className="flex-shrink-0 pt-0.5">
          {(() => {
            const { icon: Icon, className } = taskIcon(event.taskName);
            return <Icon size={16} className={className} />;
          })()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground truncate">
              {event.taskName}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${pill.bg}`}
            >
              {pill.label}
            </span>
            {hasSummary && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Show less" : "Show more"}
                className="ml-auto flex items-center gap-0.5 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <ChevronRight
                  size={12}
                  className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                />
                <span className="text-[10px]">{expanded ? "Less" : "More"}</span>
              </button>
            )}
          </div>

          {(event.projectName || event.meta?.phase) && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/60">
              {event.projectName}
              {event.projectName && event.meta?.phase ? " · " : ""}
              {event.meta?.phase}
            </p>
          )}

          {!expanded && hasSummary && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {event.summary}
            </p>
          )}

          {expanded && (
            <div className="mt-2 space-y-2">
              {hasSummary && (
                <MarkdownViewer
                  content={event.summary}
                  className="text-xs text-foreground/90"
                />
              )}
              {(event.meta?.filesChanged || event.meta?.testsCount || event.meta?.durationMs) && (
                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground/60">
                  {event.meta.filesChanged != null && (
                    <span>{event.meta.filesChanged} files</span>
                  )}
                  {event.meta.testsCount != null && (
                    <span>{event.meta.testsCount} tests</span>
                  )}
                  {event.meta.durationMs != null && (
                    <span>
                      {Math.round(event.meta.durationMs / 1000)}s
                    </span>
                  )}
                  {(event.tokensIn || event.tokensOut) && (
                    <span>
                      {((event.tokensIn ?? 0) + (event.tokensOut ?? 0)).toLocaleString()} tokens
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="mt-1 text-[10px] text-muted-foreground/60">
            {formatHistoryTime(event.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
});
