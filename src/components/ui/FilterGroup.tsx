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
      className={`flex flex-wrap items-center gap-1 ${className}`}
    >
      {options.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 min-h-[44px] lg:min-h-0 font-mono text-[10px] font-semibold uppercase tracking-wider transition-all focus-ring ${
              active
                ? "border-primary/40 bg-primary/15 text-primary-foreground dark:bg-primary/20 dark:text-primary"
                : "border-border/60 text-muted-foreground hover:bg-muted/40"
            }`}
            onClick={() => handleClick(opt.value)}
          >
            {opt.icon}
            {opt.label}
            {opt.count != null && opt.count > 0 && (
              <span
                className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold ${
                  active
                    ? "bg-primary/40 text-primary-foreground dark:bg-primary/50 dark:text-primary"
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
