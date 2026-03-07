"use client";

import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** Match `{{variableName}}` patterns in text and wrap in styled spans */
function highlightVariables(text: string): ReactNode[] {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  if (parts.length === 1) return [text];
  return parts.map((part, i) => {
    if (/^\{\{[^}]+\}\}$/.test(part)) {
      return (
        <span
          key={i}
          className="rounded px-1 py-0.5 bg-primary/15 text-foreground font-mono text-[0.92em] border border-primary/25"
        >
          {part}
        </span>
      );
    }
    return part || null;
  });
}

/** Custom component overrides that highlight {{variables}} in text */
const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children, ...props }) => (
    <p {...props}>
      {processChildren(children)}
    </p>
  ),
  li: ({ children, ...props }) => (
    <li {...props}>
      {processChildren(children)}
    </li>
  ),
  td: ({ children, ...props }) => (
    <td {...props}>
      {processChildren(children)}
    </td>
  ),
};

/** Recursively process children to highlight {{variables}} in string nodes */
function processChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") return highlightVariables(children);
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        const parts = highlightVariables(child);
        return parts.length === 1 ? parts[0] : <span key={i}>{parts}</span>;
      }
      return child;
    });
  }
  return children;
}

/**
 * Shared markdown renderer for displaying markdown content.
 * Uses react-markdown + remarkGfm with the `agent-markdown` CSS class
 * for consistent styling across panels and chat messages.
 *
 * Highlights `{{variable}}` patterns with a styled inline badge.
 */
export const MarkdownViewer = memo(function MarkdownViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const components = useMemo(() => mdComponents, []);

  return (
    <div className={cn("agent-markdown text-sm text-foreground", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
