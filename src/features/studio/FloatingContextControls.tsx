"use client";

import { memo } from "react";
import {
  FolderKanban,
  ListChecks,
  Brain,
  FolderOpen,
  Activity,
  ShieldAlert,
  X,
} from "lucide-react";
import { useEmergencyOptional } from "@/features/emergency/EmergencyProvider";
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
  const emergency = useEmergencyOptional();

  return (
    <div
      className={`fixed top-4 right-4 z-[var(--z-header)] flex items-center gap-1 rounded-full bg-background/95 p-1 shadow-lg ring-1 ring-border/20 backdrop-blur-xl transform-gpu transition-all duration-300 ease-in-out ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-4 pointer-events-none"
      }`}
      data-testid="floating-context-controls"
    >
      {/* Agent selector — compact at left */}
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

      {/* Emergency */}
      {emergency && (
        <button
          type="button"
          onClick={emergency.toggle}
          className="flex h-11 w-11 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-muted/60 hover:text-red-400"
          aria-label="Emergency controls"
          title="Emergency controls"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Context tab icons */}
      {CONTEXT_TAB_ITEMS.map(({ value, label, Icon }) => {
        const isActive = contextPanelOpen && contextTab === value;
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
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}

      {/* Close panel button */}
      {contextPanelOpen && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border/30" />
          <button
            type="button"
            onClick={onContextClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
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
