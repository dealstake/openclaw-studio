"use client";

import { memo, useState, useRef } from "react";
import { ThumbsUp, ThumbsDown, Flag, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useFeedback } from "../hooks/useFeedback";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { AnnotationRating } from "../lib/types";

// ── Types ──────────────────────────────────────────────────────────────

export type FeedbackToolbarProps = {
  sessionKey: string;
  /**
   * Stable message identifier within the session.
   * Convention: `g${groupIndex}` (e.g., "g0", "g2").
   */
  messageId: string;
  /** GatewayClient — reserved for Phase 2 RPC integration. */
  client?: GatewayClient | null;
  className?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────

const RATING_CONFIG: Record<
  AnnotationRating,
  {
    Icon: typeof ThumbsUp;
    label: string;
    activeClass: string;
    fillClass: string;
  }
> = {
  thumbs_up: {
    Icon: ThumbsUp,
    label: "Rate positively",
    activeClass: "text-emerald-500",
    fillClass: "fill-emerald-500/20",
  },
  thumbs_down: {
    Icon: ThumbsDown,
    label: "Rate negatively",
    activeClass: "text-rose-500",
    fillClass: "fill-rose-500/20",
  },
  flag: {
    Icon: Flag,
    label: "Flag this response",
    activeClass: "text-amber-500",
    fillClass: "fill-amber-500/20",
  },
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * Inline feedback toolbar for assistant messages.
 *
 * - Three rating buttons: 👍 👎 ⚑
 * - Comment popover: optional note attached to any rating
 * - Hover-reveal in parent via `group-hover/turn:opacity-100` on container
 * - Active annotations persist across sessions via localStorage (Phase 1)
 *
 * Usage:
 * ```tsx
 * <div className="group/turn flex flex-col gap-2">
 *   {renderGroupedParts(group.parts, gi)}
 *   <FeedbackToolbar
 *     sessionKey={sessionKey}
 *     messageId={`g${gi}`}
 *     className="opacity-0 transition-opacity group-hover/turn:opacity-100 data-[annotated]:opacity-100"
 *   />
 * </div>
 * ```
 */
export const FeedbackToolbar = memo(function FeedbackToolbar({
  sessionKey,
  messageId,
  client,
  className,
}: FeedbackToolbarProps) {
  const { annotation, annotate, saveComment, remove } = useFeedback({
    client,
    sessionKey,
    messageId,
  });

  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCommentOpenChange = (open: boolean) => {
    if (open) {
      // Sync draft with stored comment when popover opens (event-driven, not effect)
      setCommentDraft(annotation?.comment ?? "");
      // Defer focus — Radix needs a tick to mount the portal
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
    setCommentOpen(open);
  };

  const handleSaveComment = () => {
    saveComment(commentDraft);
    setCommentOpen(false);
  };

  const hasAnnotation = annotation !== null;

  return (
    <div
      data-annotated={hasAnnotation ? "" : undefined}
      className={cn("flex items-center gap-0.5", className)}
      role="toolbar"
      aria-label="Message feedback"
    >
      {/* Rating buttons */}
      {(Object.entries(RATING_CONFIG) as [AnnotationRating, (typeof RATING_CONFIG)[AnnotationRating]][]).map(
        ([rating, { Icon, label, activeClass, fillClass }]) => {
          const isActive = annotation?.rating === rating;
          return (
            <button
              key={rating}
              type="button"
              onClick={() => annotate(rating)}
              aria-label={isActive ? `Remove ${label.toLowerCase()}` : label}
              aria-pressed={isActive}
              title={isActive ? "Click to remove" : label}
              className={cn(
                "flex h-6 w-6 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:h-6 sm:w-6 items-center justify-center rounded-md transition-colors",
                isActive
                  ? activeClass
                  : "text-muted-foreground/40 hover:text-muted-foreground",
              )}
            >
              <Icon
                className={cn("h-3.5 w-3.5", isActive && fillClass)}
              />
            </button>
          );
        },
      )}

      {/* Comment popover */}
      <Popover open={commentOpen} onOpenChange={handleCommentOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={annotation?.comment ? "Edit comment" : "Add comment"}
            title={annotation?.comment ? `Comment: ${annotation.comment}` : "Add comment"}
            className={cn(
              "flex h-6 w-6 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:h-6 sm:w-6 items-center justify-center rounded-md transition-colors",
              annotation?.comment
                ? "text-blue-400"
                : "text-muted-foreground/40 hover:text-muted-foreground",
            )}
          >
            <MessageSquare
              className={cn(
                "h-3.5 w-3.5",
                annotation?.comment && "fill-blue-400/20",
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-3"
          align="start"
          side="top"
          sideOffset={6}
        >
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-medium text-foreground">
              {annotation?.comment ? "Edit comment" : "Add comment"}
            </p>
            <textarea
              ref={textareaRef}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Optional note about this response…"
              rows={3}
              className="w-full resize-none rounded-md border border-border/80 bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSaveComment();
                }
              }}
            />
            <div className="flex items-center gap-2">
              {hasAnnotation && (
                <button
                  type="button"
                  onClick={() => {
                    remove();
                    setCommentOpen(false);
                  }}
                  className="text-xs text-rose-400 transition-colors hover:text-rose-500"
                >
                  Remove rating
                </button>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCommentOpen(false)}
                  className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveComment}
                  className="rounded bg-primary/90 px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});
