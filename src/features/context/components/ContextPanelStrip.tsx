"use client";

import { memo } from "react";
import { PanelRight } from "lucide-react";
import type { ContextTab } from "./ContextPanel";

const TAB_ICONS: Array<{ value: ContextTab; label: string; shortLabel: string }> = [
  { value: "projects", label: "Projects", shortLabel: "P" },
  { value: "tasks", label: "Tasks", shortLabel: "T" },
  { value: "brain", label: "Brain", shortLabel: "B" },
  { value: "workspace", label: "Files", shortLabel: "F" },
  { value: "activity", label: "Activity", shortLabel: "A" },
];

interface ContextPanelStripProps {
  activeTab: ContextTab;
  onOpen: (tab?: ContextTab) => void;
}

/** Collapsed right-edge indicator strip for the context panel. Thin vertical bar with tab shortcuts. */
export const ContextPanelStrip = memo(function ContextPanelStrip({
  activeTab,
  onOpen,
}: ContextPanelStripProps) {
  return (
    <div
      className="flex h-full w-8 flex-col items-center gap-1 bg-[var(--surface-elevated)] py-3"
      data-testid="context-panel-strip"
    >
      <button
        type="button"
        onClick={() => onOpen()}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="Open context panel"
        title="Open context panel (⌘\)"
      >
        <PanelRight className="h-4 w-4" />
      </button>
      <div className="my-1 h-px w-4 bg-border/40" />
      {TAB_ICONS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onOpen(tab.value)}
          className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold transition ${
            activeTab === tab.value
              ? "bg-muted text-foreground"
              : "text-muted-foreground/60 hover:bg-muted/60 hover:text-muted-foreground"
          }`}
          aria-label={`Open ${tab.label}`}
          title={tab.label}
        >
          {tab.shortLabel}
        </button>
      ))}
    </div>
  );
});
