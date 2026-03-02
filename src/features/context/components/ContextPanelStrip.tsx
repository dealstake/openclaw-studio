"use client";

import { memo } from "react";
import { PanelRight } from "lucide-react";
import { CONTEXT_TAB_CONFIG, type ContextTab } from "../lib/tabs";

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
      className="flex h-full w-10 flex-col items-center gap-1 bg-[var(--surface-elevated)] py-3"
      data-testid="context-panel-strip"
    >
      <button
        type="button"
        onClick={() => onOpen()}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="Open context panel"
        title="Open context panel (⌘\)"
      >
        <PanelRight className="h-4 w-4" />
      </button>
      <div className="my-1 h-px w-4 bg-border/40" />
      {CONTEXT_TAB_CONFIG.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onOpen(tab.value)}
          className={`flex h-8 w-8 items-center justify-center rounded text-[10px] font-semibold transition ${
            activeTab === tab.value
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
