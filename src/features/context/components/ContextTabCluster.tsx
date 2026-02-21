"use client";

import { memo } from "react";
import { FolderKanban, ListChecks, Brain, FolderOpen, X } from "lucide-react";
import type { ContextTab } from "./ContextPanel";

const TAB_ITEMS: Array<{
  value: ContextTab;
  label: string;
  Icon: typeof FolderKanban;
}> = [
  { value: "projects", label: "Projects", Icon: FolderKanban },
  { value: "tasks", label: "Tasks", Icon: ListChecks },
  { value: "brain", label: "Brain", Icon: Brain },
  { value: "workspace", label: "Files", Icon: FolderOpen },
];

interface ContextTabClusterProps {
  activeTab: ContextTab;
  panelOpen: boolean;
  onTabClick: (tab: ContextTab) => void;
  onClose?: () => void;
}

/**
 * Floating tab button cluster for the context panel.
 * Positioned in the top-right corner of the chat canvas.
 * Clicking a tab opens the panel to that tab (or switches tab if already open).
 * Clicking the active tab when panel is open closes the panel.
 */
export const ContextTabCluster = memo(function ContextTabCluster({
  activeTab,
  panelOpen,
  onTabClick,
  onClose,
}: ContextTabClusterProps) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-full bg-background/60 backdrop-blur-md px-1.5 py-1 ring-1 ring-white/[0.06] shadow-lg"
      data-testid="context-tab-cluster"
    >
      {TAB_ITEMS.map(({ value, label, Icon }) => {
        const isActive = panelOpen && activeTab === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onTabClick(value)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
            aria-label={label}
            title={label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
      {panelOpen && onClose && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border/30" />
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Close panel"
            title="Close panel (⌘\)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
});
