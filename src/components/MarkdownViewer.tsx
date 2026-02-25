"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Shared markdown renderer for displaying markdown content.
 * Uses react-markdown + remarkGfm with the `agent-markdown` CSS class
 * for consistent styling across panels and chat messages.
 */
export const MarkdownViewer = memo(function MarkdownViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("agent-markdown text-xs text-foreground", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
});
