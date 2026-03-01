"use client";

import { memo, useState } from "react";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { MarkdownHeading } from "@/features/agents/lib/markdownHeadings";
import type { SectionHint } from "@/features/agents/lib/sectionHints";

type BrainSectionNavProps = {
  headings: MarkdownHeading[];
  activeHeading: number | null;
  onNavigate: (lineNumber: number) => void;
  hints: SectionHint[];
  /** Default collapsed state — used for tablet (defaults to false on md, true on lg+) */
  defaultCollapsed?: boolean;
};

/** Level → left padding (rem units mapped to Tailwind) */
const LEVEL_PADDING: Record<number, string> = {
  1: "pl-0",
  2: "pl-2",
  3: "pl-4",
  4: "pl-6",
  5: "pl-7",
  6: "pl-8",
};

const LEVEL_SIZE: Record<number, string> = {
  1: "font-semibold",
  2: "font-medium",
  3: "",
  4: "text-[10px]",
  5: "text-[10px]",
  6: "text-[10px]",
};

/**
 * Sidebar navigation for brain file markdown sections.
 * - Hidden on mobile (<md), collapsible on tablet (md–lg), always visible on desktop (lg+)
 * - Tooltips for sections that have a matching SectionHint
 * - Active heading highlighted
 */
export const BrainSectionNav = memo(function BrainSectionNav({
  headings,
  activeHeading,
  onNavigate,
  hints,
  defaultCollapsed = false,
}: BrainSectionNavProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // Build hint lookup map (case-insensitive)
  const hintMap = new Map(hints.map((h) => [h.heading.toLowerCase(), h.description]));

  /* ── Collapsed (tablet): thin strip with toggle ── */
  if (collapsed) {
    return (
      <div className="hidden md:flex flex-col items-center border-r border-border/60 bg-muted/20 py-2 w-8 flex-none gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Expand section navigator"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Show sections</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground/50 mt-1">
                <List className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{headings.length} section{headings.length !== 1 ? "s" : ""}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  /* ── Expanded ── */
  return (
    <div className="hidden md:flex flex-col border-r border-border/60 bg-muted/20 w-44 lg:w-52 flex-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 select-none">
          Sections
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label="Collapse section navigator"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
      </div>

      {/* Heading list */}
      <div className="flex-1 overflow-y-auto py-1 min-h-0">
        {headings.length === 0 ? (
          <p className="px-2 py-3 text-[10px] text-muted-foreground/60 italic">
            No sections
          </p>
        ) : (
          <TooltipProvider>
            <nav aria-label="Section navigator">
              {headings.map((heading) => {
                const isActive = activeHeading === heading.lineNumber;
                const hintDesc = hintMap.get(heading.text.toLowerCase());
                const indent = LEVEL_PADDING[heading.level] ?? "pl-8";
                const weight = LEVEL_SIZE[heading.level] ?? "";

                const btn = (
                  <button
                    key={`${heading.lineNumber}-${heading.text}`}
                    type="button"
                    onClick={() => onNavigate(heading.lineNumber)}
                    className={[
                      "w-full text-left px-2 py-0.5 text-xs transition-colors truncate",
                      indent,
                      weight,
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    ].join(" ")}
                    title={heading.text}
                    aria-current={isActive ? "location" : undefined}
                  >
                    {heading.text}
                  </button>
                );

                if (hintDesc) {
                  return (
                    <Tooltip key={`${heading.lineNumber}-${heading.text}`}>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px]">
                        <p>{hintDesc}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return btn;
              })}
            </nav>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
});
