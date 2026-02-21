"use client";

import React from "react";

/* ─── types ─── */

export interface PanelToolbarProps {
  /** Search / filter elements (left side) */
  children?: React.ReactNode;
  /** Action buttons (right side) */
  actions?: React.ReactNode;
  /** Extra className on wrapper */
  className?: string;
}

/**
 * Unified panel toolbar — consistent layout for search, filters, and actions
 * across all Studio panels.
 *
 * Layout: horizontal flex row. Children fill the left, actions pin right.
 * At mobile (<640px), search stacks above filters.
 */
export const PanelToolbar = React.memo(function PanelToolbar({
  children,
  actions,
  className = "",
}: PanelToolbarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 border-b border-border/30 px-4 py-2 ${className}`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      )}
    </div>
  );
});
