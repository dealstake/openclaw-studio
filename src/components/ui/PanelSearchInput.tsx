"use client";

import React, { useRef, useCallback } from "react";
import { Search, X } from "lucide-react";

export interface PanelSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Accessible label for the search input (defaults to placeholder text) */
  "aria-label"?: string;
}

/**
 * Compact search input for panel toolbars.
 * Consistent styling with clear button.
 */
export const PanelSearchInput = React.memo(function PanelSearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
  "aria-label": ariaLabel,
}: PanelSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div className={`relative min-w-[140px] ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-7 w-full rounded-md border border-border/50 bg-muted/30 pl-7 pr-7 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
      />
      {value && (
        <button
          type="button"
          className="absolute right-0 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
});
