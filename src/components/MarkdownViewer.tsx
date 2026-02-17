"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Shared markdown renderer for displaying markdown content outside of the
 * assistant-ui chat context. Uses react-markdown + remarkGfm with the
 * `agent-markdown` CSS class for consistent styling across panels.
 *
 * For chat messages, use `@/components/assistant-ui/markdown-text` instead
 * (which integrates with assistant-ui primitives).
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
