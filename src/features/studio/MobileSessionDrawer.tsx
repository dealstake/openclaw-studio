"use client";

import { memo } from "react";
import type { BreadcrumbAgent } from "@/features/agents/components/AgentBreadcrumb";
import type { ManagementTab } from "@/layout/AppSidebar";
import { SessionHistorySidebar } from "@/features/sessions/components/SessionHistorySidebar";
import { sectionLabelClass } from "@/components/SectionLabel";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

interface MobileSessionDrawerProps {
  open: boolean;
  onClose: () => void;
  breadcrumbAgents: BreadcrumbAgent[];
  focusedAgentId: string | null;
  managementView: ManagementTab | null;
  onManagementNav: (tab: ManagementTab) => void;
  onSelectAgent: (agentId: string) => void;
  client: GatewayClient;
  status: GatewayStatus;
  viewingSessionKey: string | null;
  onSelectSession: (key: string | null) => void;
  onNewSession: () => void;
}

const MANAGEMENT_ITEMS: { value: ManagementTab; label: string }[] = [
  { value: "sessions", label: "Sessions" },
  { value: "usage", label: "Usage" },
  { value: "channels", label: "Channels" },
  { value: "cron", label: "Cron" },
  { value: "settings", label: "Settings" },
];

export const MobileSessionDrawer = memo(function MobileSessionDrawer({
  open,
  onClose,
  breadcrumbAgents,
  focusedAgentId,
  managementView,
  onManagementNav,
  onSelectAgent,
  client,
  status,
  viewingSessionKey,
  onSelectSession,
  onNewSession,
}: MobileSessionDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="mobile-drawer-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="absolute inset-y-0 left-0 w-[280px] animate-in slide-in-from-left duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] bg-[var(--surface-elevated)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mobile-drawer-title" className="sr-only">Main Menu</h2>
        {/* Agent list for mobile */}
        {breadcrumbAgents.length > 1 && (
          <div className="border-b border-border/40 px-3 py-3">
            <p className={`${sectionLabelClass} mb-1.5 px-0.5 text-[10px]`}>Agents</p>
            <div className="flex flex-col gap-0.5">
              {breadcrumbAgents.map((agent) => (
                <button
                  key={agent.agentId}
                  type="button"
                  onClick={() => {
                    onSelectAgent(agent.agentId);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-[13px] font-medium transition-colors min-h-[44px] ${
                    agent.agentId === focusedAgentId
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/80 hover:bg-muted"
                  }`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                    agent.status === "running" ? "bg-emerald-400" : "bg-muted-foreground/30"
                  }`} />
                  {agent.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Management nav items for mobile */}
        <div className="flex flex-col gap-0.5 border-b border-border/40 px-3 py-3">
          {MANAGEMENT_ITEMS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onManagementNav(item.value);
                onClose();
              }}
              className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors min-h-[44px] ${
                managementView === item.value
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/80 hover:bg-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {/* Session history */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SessionHistorySidebar
            client={client}
            status={status}
            agentId={focusedAgentId}
            activeSessionKey={viewingSessionKey ?? (focusedAgentId ? `${focusedAgentId}:main` : null)}
            onSelectSession={(key) => {
              onSelectSession(key === `${focusedAgentId}:main` ? null : key);
              onClose();
            }}
            onNewSession={() => {
              onNewSession();
              onClose();
            }}
            collapsed={false}
            onToggleCollapse={onClose}
          />
        </div>
      </div>
    </div>
  );
});
