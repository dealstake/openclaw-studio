"use client";

import React, { useRef, useCallback } from "react";
import { Search, X } from "lucide-react";

export type SearchInputVariant = "default" | "compact";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  /** Accessible label for the search input (defaults to placeholder text) */
  "aria-label"?: string;
  /** Visual variant: "default" for sidebar/page use, "compact" for panel toolbars */
  variant?: SearchInputVariant;
}

const variantStyles = {
  default: {
    wrapper: "",
    icon: "h-3.5 w-3.5",
    input:
      "rounded-md border border-border/80 bg-card/70 py-1.5 pl-8 pr-8 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20",
    clearBtn: "right-2",
    clearIcon: "h-3.5 w-3.5",
  },
  compact: {
    wrapper: "min-w-[140px]",
    icon: "h-3 w-3",
    input:
      "h-7 rounded-md border border-border/50 bg-muted/30 pl-7 pr-7 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20",
    clearBtn: "right-0.5 flex h-8 w-8 items-center justify-center rounded-full",
    clearIcon: "h-4 w-4",
  },
} as const;

/**
 * Unified search input with clear button.
 * - `variant="default"` — sidebar / page-level search
 * - `variant="compact"` — panel toolbar search
 */
export const SearchInput = React.memo(function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search…",
  className = "",
  "aria-label": ariaLabel,
  variant = "default",
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const s = variantStyles[variant];

  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    } else {
      onChange("");
    }
    inputRef.current?.focus();
  }, [onChange, onClear]);

  return (
    <div className={`relative ${s.wrapper} ${className}`}>
      <Search
        className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 ${s.icon}`}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={`w-full ${s.input}`}
      />
      {value && (
        <button
          type="button"
          className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground ${s.clearBtn}`}
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X className={s.clearIcon} />
        </button>
      )}
    </div>
  );
});
