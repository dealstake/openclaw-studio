"use client";

import { memo, useCallback, useState } from "react";
import { ChevronRight, FileSearch, Loader2 } from "lucide-react";
import { isReasoningPart, isToolInvocationPart } from "@/lib/chat/types";
import type { ActivityMessage } from "@/features/activity/hooks/useActivityMessageStore";
import { taskIcon, STATUS_COLORS, formatTime } from "@/features/activity/lib/activityDisplayUtils";
import { MessagePartsRenderer, getTextContent } from "./MessagePartsRenderer";
import { formatTokens, formatCost } from "@/lib/text/format";
import { openTraceFromKey } from "@/features/sessions/state/traceViewStore";
import { ActivityActionMenu } from "./ActivityActionMenu";

/** Card for a single live activity message (streaming or complete) */
export const ActivityMessageCard = memo(function ActivityMessageCard({
  entry,
}: {
  entry: ActivityMessage;
}) {
  const [expanded, setExpanded] = useState(false);
  const handleViewTrace = useCallback(() => {
    if (entry.sourceKey) openTraceFromKey(entry.sourceKey);
  }, [entry.sourceKey]);
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
    if (lastBoundary > 20) return raw.slice(0, lastBoundary + 1);
    // Fallback: truncate at last space to avoid mid-word cut
    const lastSpace = raw.lastIndexOf(" ");
    return lastSpace > 20 ? raw.slice(0, lastSpace) : raw;
  })();

  return (
    <div className="group/card rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
      <div className="flex gap-2.5">
        <div className="flex-shrink-0 pt-0.5">
          {(() => {
            const { icon: Icon, className } = taskIcon(entry.sourceName);
            return <Icon size={16} className={className} />;
          })()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground truncate transition-colors duration-150 group-hover/card:text-primary">
              {entry.sourceName || "Activity"}
            </span>
            <span
              role="img"
              aria-label={`Status: ${entry.status}`}
              className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[entry.status] ?? "bg-muted-foreground/30"} ${isStreaming ? "animate-pulse" : ""}`}
            />
            <div className="ml-auto flex items-center gap-1">
              <ActivityActionMenu
                sessionKey={entry.sourceKey}
                taskName={entry.sourceName}
                status={entry.status}
              />
              {entry.sourceKey && (
                <button
                  type="button"
                  onClick={handleViewTrace}
                  aria-label="View trace"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-1 py-0.5 text-muted-foreground opacity-0 transition-all group-hover/card:opacity-100 group-hover/card:text-foreground/80 hover:bg-muted/60 hover:text-foreground focus:opacity-100"
                >
                  <FileSearch size={12} />
                </button>
              )}
              {hasRichContent && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-label={expanded ? "Show less" : "Show more"}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-0.5 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                  />
                  <span className="text-[10px]">{expanded ? "Less" : "More"}</span>
                </button>
              )}
            </div>
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

          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{formatTime(entry.timestamp)}</span>
            {((entry.tokensIn ?? 0) + (entry.tokensOut ?? 0) > 0) && (
              <span>{formatTokens((entry.tokensIn ?? 0) + (entry.tokensOut ?? 0))} tokens</span>
            )}
            {(entry.totalCost != null && entry.totalCost > 0) && (
              <span>{formatCost(entry.totalCost)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
