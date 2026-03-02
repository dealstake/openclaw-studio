"use client";

import { memo } from "react";
import { X } from "lucide-react";
import type { BreadcrumbAgent } from "@/features/agents/components/AgentBreadcrumb";
import { CONTEXT_TAB_CONFIG } from "@/features/context/lib/tabs";
import type { ContextTab } from "@/features/context/components/ContextPanel";

interface FloatingContextControlsProps {
  agents: BreadcrumbAgent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent?: () => void;
  contextTab: ContextTab;
  contextPanelOpen: boolean;
  onContextTabClick: (tab: ContextTab) => void;
  onContextClose: () => void;
  visible: boolean;
}

export const FloatingContextControls = memo(function FloatingContextControls({
  // Agent props kept in interface for parent compat — agent picker moved to composer
  contextTab,
  contextPanelOpen,
  onContextTabClick,
  onContextClose,
  visible,
}: FloatingContextControlsProps) {
  const baseTransition = `transform-gpu transition-all duration-300 ease-in-out ${
    visible
      ? "opacity-100 translate-y-0"
      : "opacity-0 -translate-y-4 pointer-events-none"
  }`;

  // Panel CLOSED: compact pill at top-right with context tab icons only
  if (!contextPanelOpen) {
    return (
      <div
        className={`fixed top-4 right-4 z-[var(--z-header)] flex min-w-0 items-center gap-1 rounded-full bg-surface-elevated/95 p-1 shadow-lg ring-1 ring-border/20 backdrop-blur-xl ${baseTransition}`}
        data-testid="floating-context-controls"
      >
        {CONTEXT_TAB_CONFIG.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onContextTabClick(value)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label={label}
            title={label}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </div>
    );
  }

  // Panel OPEN: context tab icons docked inside the panel area
  return (
    <>
      {/* Context tab icons — docked inside the panel area */}
      <div
        className={`fixed top-4 right-4 z-[var(--z-header)] flex items-center gap-0.5 rounded-full bg-surface-elevated/95 p-1 shadow-lg ring-1 ring-border/20 backdrop-blur-xl ${baseTransition}`}
        data-testid="context-panel-tabs"
        /* 5 icons × 44px + close + gaps ≈ ~310px — fits within 360px panel */
      >
        {CONTEXT_TAB_CONFIG.map(({ value, label, Icon }) => {
          const isActive = contextTab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onContextTabClick(value)}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
              aria-label={label}
              title={label}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
        <div className="mx-0.5 h-4 w-px bg-border/30" />
        <button
          type="button"
          onClick={onContextClose}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="Close panel"
          title="Close panel (⌘\)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </>
  );
});
