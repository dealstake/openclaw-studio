"use client";

import { memo } from "react";

export type SessionView = "active" | "history";

type SessionViewToggleProps = {
  value: SessionView;
  onChange: (view: SessionView) => void;
};

export const SessionViewToggle = memo(function SessionViewToggle({
  value,
  onChange,
}: SessionViewToggleProps) {
  return (
    <div
      className="flex rounded-lg bg-muted/50 p-0.5"
      role="tablist"
      aria-label="Session view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "active"}
        onClick={() => onChange("active")}
        className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-all duration-150 ${
          value === "active"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Active
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "history"}
        onClick={() => onChange("history")}
        className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-all duration-150 ${
          value === "history"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        History
      </button>
    </div>
  );
});
