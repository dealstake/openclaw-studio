"use client";

import React, { memo, type ReactNode } from "react";

/* ─── types ─── */

export interface PanelHeaderProps {
  icon?: ReactNode;
  title: string;
  /** Action buttons (refresh, add, etc.) */
  actions?: ReactNode;
  /** Filter pills or sub-tabs rendered below title line */
  filters?: ReactNode;
  className?: string;
}

/**
 * Unified panel header — compact, no separator, icon + title inline.
 * Replaces ad-hoc SectionLabel + border-b patterns across all panels.
 *
 * Layout:
 * ┌─────────────────────────────┐
 * │ 🔑 Credentials    [+] [↻]  │  ← icon + title + actions (single row)
 * │ ● All  ● Active  ● Custom  │  ← optional filter pills (compact row)
 * └─────────────────────────────┘
 * No separator. No excess padding. Floating aesthetic.
 */
export const PanelHeader = memo(function PanelHeader({
  icon,
  title,
  actions,
  filters,
  className = "",
}: PanelHeaderProps) {
  return (
    <div className={`flex flex-col gap-1.5 px-3 pt-3 pb-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {icon && (
            <div className="flex shrink-0 items-center text-muted-foreground">
              {icon}
            </div>
          )}
          <h3 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground truncate">
            {title}
          </h3>
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        )}
      </div>
      {filters && (
        <div className="flex flex-wrap items-center gap-1.5">{filters}</div>
      )}
    </div>
  );
});
