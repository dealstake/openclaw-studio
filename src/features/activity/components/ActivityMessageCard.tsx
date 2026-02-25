"use client";

import { memo, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { isReasoningPart, isToolInvocationPart } from "@/lib/chat/types";
import type { ActivityMessage } from "@/features/activity/hooks/useActivityMessageStore";
import { taskIcon, STATUS_COLORS, formatTime } from "@/features/activity/lib/activityDisplayUtils";
import { MessagePartsRenderer, getTextContent } from "./MessagePartsRenderer";

/** Card for a single live activity message (streaming or complete) */
export const ActivityMessageCard = memo(function ActivityMessageCard({
  entry,
}: {
  entry: ActivityMessage;
}) {
  const [expanded, setExpanded] = useState(false);
  const isStreaming = entry.status === "streaming";
  const fullText = getTextContent(entry.parts);
  const hasRichContent =
    entry.parts.length > 1 ||
    entry.parts.some((p) => isReasoningPart(p) || isToolInvocationPart(p)) ||
    fullText.length > 200;

  // During streaming, show text truncated to last sentence boundary
  // to avoid mid-word flicker from token-by-token updates.
  const textSnippet = (() => {
    const raw = fullText.slice(0, 200);
    if (!isStreaming || !raw) return raw;
    // Find last sentence boundary for clean display
    const lastBoundary = Math.max(
      raw.lastIndexOf(". "),
      raw.lastIndexOf(".\n"),
      raw.lastIndexOf("! "),
      raw.lastIndexOf("? "),
    );
    return lastBoundary > 20 ? raw.slice(0, lastBoundary + 1) : raw;
  })();

  return (
    <div className="group rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
      <div className="flex gap-2.5">
        <div className="flex-shrink-0 pt-0.5">
          {(() => {
            const { icon: Icon, className } = taskIcon(entry.sourceName);
            return <Icon size={16} className={className} />;
          })()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground truncate">
              {entry.sourceName || "Activity"}
            </span>
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[entry.status] ?? "bg-muted-foreground/30"} ${isStreaming ? "animate-pulse" : ""}`}
            />
            {hasRichContent && (
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

          {!expanded && isStreaming && !textSnippet && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 size={10} className="animate-spin" />
              Working…
            </p>
          )}

          {!expanded && textSnippet && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">
              {textSnippet}
            </p>
          )}

          {expanded && (
            <div className="mt-2">
              <MessagePartsRenderer parts={entry.parts} />
            </div>
          )}

          <p className="mt-1 text-[10px] text-muted-foreground/60">
            {formatTime(entry.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
});
