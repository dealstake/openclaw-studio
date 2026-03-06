"use client";

import React from "react";

/* ─── types ─── */

export interface FilterGroupOption<V extends string = string> {
  value: V;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export interface FilterGroupProps<V extends string = string> {
  options: FilterGroupOption<V>[];
  /** Selected values (multi-select) */
  value: V[];
  onChange: (value: V[]) => void;
  /** If true, allows deselecting all options. Default: false (at least one must remain). */
  allowEmpty?: boolean;
  /** Extra className on wrapper */
  className?: string;
  /** ID of the list/region this filter controls (for aria-controls) */
  controlsId?: string;
}

/**
 * Unified filter group for panel-level filtering.
 * Multi-select with flex-wrap, modern pill styling, count badges, and ARIA.
 *
 * Replaces FilterPillGroup across Projects, Tasks, and Activity panels.
 */
export const FilterGroup = React.memo(function FilterGroup<V extends string = string>({
  options,
  value,
  onChange,
  allowEmpty = false,
  className = "",
  controlsId,
}: FilterGroupProps<V>) {
  const handleClick = (optValue: V) => {
    const isActive = value.includes(optValue);
    if (isActive) {
      const next = value.filter((v) => v !== optValue);
      if (!allowEmpty && next.length === 0) return; // Can't deselect last
      onChange(next);
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <div
      role="group"
      aria-label="Filters"
      aria-controls={controlsId}
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
    >
      {options.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 min-h-[44px] md:min-h-0 font-sans text-xs font-semibold tracking-[0.08em] transition-all focus-ring ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-foreground/80 border border-border/60 hover:bg-muted/40 hover:border-border/70"
            }`}
            onClick={() => handleClick(opt.value)}
          >
            {opt.icon}
            {opt.label}
            {opt.count != null && opt.count > 0 && (
              <span
                className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted-foreground/25 text-muted-foreground"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}) as <V extends string = string>(props: FilterGroupProps<V>) => React.ReactNode;
