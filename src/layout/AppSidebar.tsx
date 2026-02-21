"use client";

import { memo, useCallback, useRef } from "react";
import {
  MessageSquare,
  BarChart3,
  Radio,
  Clock,
  Settings,
  Plus,
  ChevronLeft,
  Search,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sectionLabelClass } from "@/components/SectionLabel";
import { formatRelativeTime } from "@/lib/text/time";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useSessionHistory, type SessionHistoryEntry } from "@/features/sessions/hooks/useSessionHistory";
import { useEffect } from "react";

/** Management nav items that open in expanded modal */
export type ManagementTab = "sessions" | "usage" | "channels" | "cron" | "settings";

const NAV_ITEMS: Array<{ value: ManagementTab; label: string; icon: typeof MessageSquare; shortcut?: string }> = [
  { value: "sessions", label: "Sessions", icon: MessageSquare },
  { value: "usage", label: "Usage", icon: BarChart3 },
  { value: "channels", label: "Channels", icon: Radio },
  { value: "cron", label: "Cron", icon: Clock },
  { value: "settings", label: "Settings", icon: Settings },
];

/* ─── Session list item ─── */
const SessionItem = memo(function SessionItem({
  session,
  active,
  onSelect,
}: {
  session: SessionHistoryEntry;
  active: boolean;
  onSelect: (key: string) => void;
}) {
  const handleClick = useCallback(() => onSelect(session.key), [onSelect, session.key]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground/80 hover:bg-muted"
      }`}
    >
      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight">
          {session.displayName}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {formatRelativeTime(session.updatedAt)}
          {session.messageCount > 0 ? ` · ${session.messageCount} msgs` : ""}
        </p>
      </div>
    </button>
  );
});

/* ─── Main sidebar ─── */
interface AppSidebarProps {
  client: GatewayClient;
  status: GatewayStatus;
  agentId: string | null;
  activeSessionKey: string | null;
  onSelectSession: (sessionKey: string) => void;
  onNewSession: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onManagementNav: (tab: ManagementTab) => void;
  activeManagementTab?: ManagementTab | null;
}

export const AppSidebar = memo(function AppSidebar({
  client,
  status,
  agentId,
  activeSessionKey,
  onSelectSession,
  onNewSession,
  collapsed,
  onToggleCollapse,
  onManagementNav,
  activeManagementTab,
}: AppSidebarProps) {
  const { groups, loading, load, search, setSearch } = useSessionHistory(client, status, agentId);

  useEffect(() => {
    void load();
  }, [load]);

  const navContainerRef = useRef<HTMLDivElement>(null);

  /** Arrow-key navigation within sidebar nav items */
  const handleNavKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const items = navContainerRef.current?.querySelectorAll<HTMLButtonElement>("[data-nav-item]");
      if (!items) return;
      let nextIndex = -1;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        nextIndex = (index + 1) % items.length;
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        nextIndex = (index - 1 + items.length) % items.length;
      }
      if (nextIndex >= 0) items[nextIndex]?.focus();
    },
    [],
  );

  /* ── Collapsed: icon rail only ── */
  if (collapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center border-r border-border/20 bg-[var(--surface-elevated)] py-3">
        <TooltipProvider delayDuration={300}>
          <div ref={navContainerRef} role="navigation" aria-label="Management navigation">
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeManagementTab === item.value;
            return (
              <Tooltip key={item.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-nav-item
                    onClick={() => onManagementNav(item.value)}
                    onKeyDown={(e) => handleNavKeyDown(e, index)}
                    className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 ${
                      isActive
                        ? "bg-accent text-accent-foreground before:absolute before:inset-y-1 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
          </div>
        </TooltipProvider>
        <div className="my-2 h-px w-5 bg-border/40" />
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Expand sidebar"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </div>
    );
  }

  /* ── Expanded: nav icons + session history ── */
  return (
    <div className="flex h-full w-[240px] flex-col border-r border-border/20 bg-[var(--surface-elevated)]">
      {/* Management nav */}
      <div ref={navContainerRef} className="flex items-center gap-1 border-b border-border/20 px-2 py-2" role="navigation" aria-label="Management navigation">
        <TooltipProvider delayDuration={300}>
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeManagementTab === item.value;
            return (
              <Tooltip key={item.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-nav-item
                    onClick={() => onManagementNav(item.value)}
                    onKeyDown={(e) => handleNavKeyDown(e, index)}
                    className={`relative flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150 ${
                      isActive
                        ? "bg-accent text-accent-foreground before:absolute before:-bottom-2 before:left-1.5 before:right-1.5 before:h-0.5 before:rounded-full before:bg-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>

      {/* Session history header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className={`${sectionLabelClass} flex-1`}>Sessions</span>
        <button
          type="button"
          onClick={onNewSession}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          aria-label="New session"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-2 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions…"
            className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {loading && groups.length === 0 ? (
          <div className="px-2 py-4 text-center text-[12px] text-muted-foreground">
            Loading sessions…
          </div>
        ) : groups.length === 0 ? (
          <div className="px-2 py-4 text-center text-[12px] text-muted-foreground">
            {search ? "No matching sessions" : "No sessions yet"}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-2">
              <div className={`${sectionLabelClass} px-2.5 py-1.5 text-[10px]`}>
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.sessions.map((session) => (
                  <SessionItem
                    key={session.key}
                    session={session}
                    active={session.key === activeSessionKey}
                    onSelect={onSelectSession}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
