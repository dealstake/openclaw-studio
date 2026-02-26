"use client";

import { memo } from "react";
import {
  FolderKanban,
  ListChecks,
  Brain,
  FolderOpen,
  Activity,
  X,
} from "lucide-react";
import { AgentBreadcrumb, type BreadcrumbAgent } from "@/features/agents/components/AgentBreadcrumb";
import type { ContextTab } from "@/features/context/components/ContextPanel";

const CONTEXT_TAB_ITEMS: Array<{
  value: ContextTab;
  label: string;
  Icon: typeof FolderKanban;
}> = [
  { value: "projects", label: "Projects", Icon: FolderKanban },
  { value: "tasks", label: "Tasks", Icon: ListChecks },
  { value: "brain", label: "Brain", Icon: Brain },
  { value: "workspace", label: "Files", Icon: FolderOpen },
  { value: "activity", label: "Activity", Icon: Activity },
];

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
  agents,
  selectedAgentId,
  onSelectAgent,
  onCreateAgent,
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

  // Panel CLOSED: single compact pill at top-right with agent selector + context icons
  if (!contextPanelOpen) {
    return (
      <div
        className={`fixed top-4 right-4 z-[var(--z-header)] flex items-center gap-1 rounded-full bg-background/95 p-1 shadow-lg ring-1 ring-border/20 backdrop-blur-xl ${baseTransition}`}
        data-testid="floating-context-controls"
      >
        {agents.length > 0 && (
          <>
            <AgentBreadcrumb
              agents={agents}
              selectedAgentId={selectedAgentId}
              onSelectAgent={onSelectAgent}
              onCreateAgent={onCreateAgent}
            />
            <div className="mx-0.5 h-4 w-px bg-border/30" />
          </>
        )}

        {CONTEXT_TAB_ITEMS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onContextTabClick(value)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label={label}
            title={label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    );
  }

  // Panel OPEN: split into two elements
  // 1. Agent selector floats just left of the panel border
  // 2. Context tab icons dock inside the panel's top area
  return (
    <>
      {/* Agent selector — positioned just left of the 360px context panel */}
      {agents.length > 0 && (
        <div
          className={`fixed top-4 right-[calc(360px+1.5rem)] z-[var(--z-header)] ${baseTransition}`}
          data-testid="floating-agent-selector"
        >
          <div className="flex items-center rounded-full bg-background/95 p-1 shadow-lg ring-1 ring-border/20 backdrop-blur-xl">
            <AgentBreadcrumb
              agents={agents}
              selectedAgentId={selectedAgentId}
              onSelectAgent={onSelectAgent}
              onCreateAgent={onCreateAgent}
            />
          </div>
        </div>
      )}

      {/* Context tab icons — docked inside the panel area */}
      <div
        className={`fixed top-4 right-4 z-[var(--z-header)] flex items-center gap-0.5 rounded-full bg-background/95 p-1 shadow-lg ring-1 ring-border/20 backdrop-blur-xl ${baseTransition}`}
        data-testid="context-panel-tabs"
        /* 5 icons × 36px + close + gaps ≈ ~280px — fits within 360px panel */
      >
        {CONTEXT_TAB_ITEMS.map(({ value, label, Icon }) => {
          const isActive = contextTab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onContextTabClick(value)}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
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
        <div className="mx-0.5 h-4 w-px bg-border/30" />
        <button
          type="button"
          onClick={onContextClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="Close panel"
          title="Close panel (⌘\)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
});
