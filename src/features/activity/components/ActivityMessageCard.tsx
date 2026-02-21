"use client";

import { memo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { isReasoningPart, isToolInvocationPart } from "@/lib/chat/types";
import type { ActivityMessage } from "@/features/activity/hooks/useActivityMessageStore";
import { taskEmoji, STATUS_COLORS, formatTime } from "@/features/activity/lib/activityDisplayUtils";
import { MessagePartsRenderer, getTextContent } from "./MessagePartsRenderer";

/** Card for a single live activity message (streaming or complete) */
export const ActivityMessageCard = memo(function ActivityMessageCard({
  entry,
}: {
  entry: ActivityMessage;
}) {
  const [expanded, setExpanded] = useState(false);
  const isStreaming = entry.status === "streaming";
  const textSnippet = getTextContent(entry.parts).slice(0, 200);
  const hasRichContent =
    entry.parts.length > 1 ||
    entry.parts.some((p) => isReasoningPart(p) || isToolInvocationPart(p)) ||
    getTextContent(entry.parts).length > 200;

  return (
    <div className="group rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
      <div className="flex gap-2.5">
        <div className="flex-shrink-0 pt-0.5 text-base leading-none">
          {taskEmoji(entry.sourceName)}
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
                className="ml-auto flex items-center gap-0.5 rounded-md px-1 py-0.5 text-muted-foreground/50 transition-colors hover:bg-muted/60 hover:text-muted-foreground"
              >
                <ChevronRight
                  size={12}
                  className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                />
                <span className="text-[10px]">{expanded ? "Less" : "More"}</span>
              </button>
            )}
          </div>

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
