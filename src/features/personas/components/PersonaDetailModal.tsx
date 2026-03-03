"use client";

import React, { memo, useMemo, useState } from "react";
import {
  User,
  Brain,
  Settings,
  Mic,
  BookOpen,
  Dumbbell,
  BarChart3,
} from "lucide-react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetClose,
  SideSheetBody,
  SideSheetTitle,
} from "@/components/ui/SideSheet";
import { cn } from "@/lib/utils";
import type { AgentState } from "@/features/agents/state/store";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { GatewayModelChoice } from "@/lib/gateway/models";

// ---------------------------------------------------------------------------
// Tab definition
// ---------------------------------------------------------------------------

const DETAIL_TABS = [
  { value: "overview", label: "Overview", icon: User },
  { value: "brain", label: "Brain", icon: Brain },
  { value: "settings", label: "Settings", icon: Settings },
  { value: "voice", label: "Voice", icon: Mic },
  { value: "knowledge", label: "Knowledge", icon: BookOpen },
  { value: "practice", label: "Practice", icon: Dumbbell },
  { value: "metrics", label: "Metrics", icon: BarChart3 },
] as const;

type DetailTab = (typeof DETAIL_TABS)[number]["value"];

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  configuring:
    "bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20",
  active:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20",
  paused:
    "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20",
  archived:
    "bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20",
};

// ---------------------------------------------------------------------------
// Overview tab (inline — lightweight)
// ---------------------------------------------------------------------------

function OverviewTab({ agent }: { agent: AgentState }) {
  const statusLabel = agent.personaStatus ?? "unknown";
  return (
    <div className="flex flex-col gap-4">
      {/* Identity card */}
      <div className="flex items-start gap-3 rounded-lg border border-border/30 bg-muted/20 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {(agent.name?.[0] ?? agent.agentId[0]).toUpperCase()}
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-foreground">
            {agent.name ?? agent.agentId}
          </h3>
          {agent.roleDescription && (
            <p className="text-xs text-muted-foreground">
              {agent.roleDescription}
            </p>
          )}
          <div className="flex items-center gap-2 pt-0.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                STATUS_STYLES[statusLabel] ?? STATUS_STYLES.draft,
              )}
            >
              {statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}
            </span>
            {agent.personaCategory && (
              <span className="text-[10px] text-muted-foreground/70">
                {agent.personaCategory}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Practice", value: String(agent.practiceCount ?? 0) },
          { label: "Template", value: agent.templateKey ?? "Custom" },
          {
            label: "Main Agent",
            value: agent.isMainAgent ? "Yes" : "No",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center rounded-md border border-border/20 bg-muted/10 px-2 py-2"
          >
            <span className="text-xs font-medium text-foreground">
              {s.value}
            </span>
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Optimization goals */}
      {agent.optimizationGoals && agent.optimizationGoals.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Optimization Goals
          </span>
          <div className="flex flex-wrap gap-1">
            {agent.optimizationGoals.map((g) => (
              <span
                key={g}
                className="rounded-md bg-primary/8 px-2 py-0.5 text-[11px] text-primary"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder tab (for tabs not yet implemented)
// ---------------------------------------------------------------------------

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <p className="text-sm text-muted-foreground">{label} — coming soon</p>
      <p className="text-xs text-muted-foreground/70">
        This tab will be implemented in subsequent phases.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export interface PersonaDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The agent/persona to display details for */
  agent: AgentState | null;
  /** All agents (passed to BrainPanel) */
  agents: AgentState[];
  /** Gateway client for API calls */
  client: GatewayClient;
  /** Gateway connection status */
  status: GatewayStatus;
  /** Available models */
  models?: GatewayModelChoice[];
}

export const PersonaDetailModal = memo(function PersonaDetailModal({
  open,
  onOpenChange,
  agent,
  agents,
  client,
  status,
  models,
}: PersonaDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  // agents, client, status, models will be passed to embedded panels in Phase 3b
  void agents; void client; void status; void models;

  const tabContent = useMemo(() => {
    if (!agent) return null;
    switch (activeTab) {
      case "overview":
        return <OverviewTab agent={agent} />;
      case "brain":
        return <PlaceholderTab label="Brain file editor" />;
      case "settings":
        return <PlaceholderTab label="Agent settings" />;
      case "voice":
        return <PlaceholderTab label="Voice configuration" />;
      case "knowledge":
        return <PlaceholderTab label="Knowledge base" />;
      case "practice":
        return <PlaceholderTab label="Practice sessions" />;
      case "metrics":
        return <PlaceholderTab label="Performance metrics" />;
      default:
        return null;
    }
  }, [activeTab, agent]);

  if (!agent) return null;

  return (
    <SideSheet open={open} onOpenChange={onOpenChange}>
      <SideSheetContent className="max-w-lg">
        <SideSheetHeader>
          <SideSheetTitle className="text-sm font-semibold">
            {agent.name ?? agent.agentId}
          </SideSheetTitle>
          <SideSheetClose />
        </SideSheetHeader>

        {/* Tab bar */}
        <div
          className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border/30 px-2"
          role="tablist"
          aria-label="Persona detail tabs"
        >
          {DETAIL_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex min-h-[44px] items-center gap-1.5 whitespace-nowrap px-2.5 text-[11px] font-medium transition-colors md:min-h-9",
                  "border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <SideSheetBody>{tabContent}</SideSheetBody>
      </SideSheetContent>
    </SideSheet>
  );
});
