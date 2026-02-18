"use client";

import { memo } from "react";
import { sectionLabelClass } from "@/components/SectionLabel";

const FILTER_OPTIONS = [
  { key: null, label: "All" },
  { key: "Project Continuation", label: "Continuation" },
  { key: "Codebase Auditor", label: "Audit" },
  { key: "Product Research", label: "Research" },
  { key: "Visual QA Auditor", label: "Visual QA" },
  { key: "__errors__", label: "Errors" },
] as const;

export const ActivityFilterBar = memo(function ActivityFilterBar({
  activeFilter,
  onFilterChange,
  counts,
}: {
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
      {FILTER_OPTIONS.map(({ key, label }) => {
        const count = key === null ? counts.__total ?? 0 : counts[key ?? ""] ?? 0;
        if (key !== null && count === 0) return null;
        const isActive = activeFilter === key;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={isActive}
            className={`${sectionLabelClass} shrink-0 rounded-md border px-1.5 py-0.5 transition ${
              isActive
                ? "border-border bg-muted text-foreground shadow-xs"
                : "border-border/60 bg-card/50 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
            onClick={() => onFilterChange(isActive ? null : key)}
          >
            {label}
            {count > 0 ? ` ${count}` : ""}
          </button>
        );
      })}
    </div>
  );
});
