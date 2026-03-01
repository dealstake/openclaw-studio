"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { MarkdownViewer } from "@/components/MarkdownViewer";

// ── Types ──────────────────────────────────────────────────────────────

export type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  /** Optional action buttons (copy, etc.) rendered on hover */
  actions?: React.ReactNode;
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * Shared message bubble used by both main chat and wizard chat.
 *
 * - **User**: right-aligned, subtle muted background, rounded pill with
 *   bottom-right corner flattened.
 * - **Assistant**: flush-left, no background, just text with relaxed leading.
 *   ChatGPT-style borderless rendering.
 */
export const MessageBubble = React.memo(function MessageBubble({
  role,
  content,
  streaming = false,
  actions,
  className,
}: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div className={cn("group/message relative flex justify-end", className)}>
        <div className="max-w-[85%] rounded-3xl rounded-br-sm bg-muted/50 px-4 py-2.5 text-foreground">
          <MarkdownViewer content={content} />
        </div>
        {actions}
      </div>
    );
  }

  // Assistant — flush left, no background (ChatGPT style)
  return (
    <div className={cn("group/message relative", className)}>
      <div className="max-w-[100%] px-4 py-2.5 text-foreground">
        <MarkdownViewer
          content={content}
          className={cn(
            "leading-relaxed min-w-0 overflow-hidden text-foreground/90",
            streaming && "opacity-80",
          )}
        />
      </div>
      {!streaming && actions}
    </div>
  );
});
