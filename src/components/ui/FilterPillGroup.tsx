"use client";

import React from "react";

/* ─── types ─── */

export interface FilterOption<V extends string = string> {
  value: V;
  label: string;
  count?: number;
}

export interface FilterPillGroupProps<V extends string = string> {
  options: FilterOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Extra className on wrapper */
  className?: string;
}

/**
 * Horizontal pill group for panel-level filtering.
 * Follows consistent styling across all panels.
 */
export const FilterPillGroup = React.memo(function FilterPillGroup({
  options,
  value,
  onChange,
  className = "",
}: FilterPillGroupProps<string>) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition focus-ring ${
              active
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-muted/40"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
            {opt.count != null && opt.count > 0 && (
              <span
                className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold ${
                  active
                    ? "bg-primary/20 text-primary"
                    : "bg-muted-foreground/15 text-muted-foreground"
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
}) as <V extends string = string>(props: FilterPillGroupProps<V>) => React.ReactNode;
