"use client";

import { memo, useCallback, useRef, useEffect } from "react";
import {
  MessageSquare,
  BarChart3,
  Radio,
  Settings,
  Plus,
  ChevronLeft,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sectionLabelClass } from "@/components/SectionLabel";
import { SearchInput } from "@/components/SearchInput";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useSessionHistory } from "@/features/sessions/hooks/useSessionHistory";
import { SessionList } from "@/features/sessions/components/SessionList";

/** Management nav items that open in expanded modal */
export type ManagementTab = "sessions" | "usage" | "channels" | "settings";

const NAV_ITEMS: Array<{ value: ManagementTab; label: string; icon: typeof MessageSquare }> = [
  { value: "sessions", label: "Sessions", icon: MessageSquare },
  { value: "usage", label: "Usage", icon: BarChart3 },
  { value: "channels", label: "Channels", icon: Radio },
];

const ALL_NAV_ITEMS = [...NAV_ITEMS, { value: "settings" as ManagementTab, label: "Settings", icon: Settings }];

/* ─── Shared nav icon button ─── */
type NavIconButtonProps = {
  item: { value: ManagementTab; label: string; icon: typeof MessageSquare };
  isActive: boolean;
  size: "sm" | "md";
  indicatorPosition: "left" | "bottom";
  tooltipSide: "right" | "bottom";
  onClick: (tab: ManagementTab) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
};

const NavIconButton = memo(function NavIconButton({
  item,
  isActive,
  size,
  indicatorPosition,
  tooltipSide,
  onClick,
  onKeyDown,
}: NavIconButtonProps) {
  const Icon = item.icon;
  const sizeClass = size === "sm" ? "h-10 w-10" : "h-11 w-11";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const indicatorClass =
    indicatorPosition === "left"
      ? "before:absolute before:inset-y-1 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary"
      : "before:absolute before:-bottom-2 before:left-1.5 before:right-1.5 before:h-0.5 before:rounded-full before:bg-primary";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-nav-item
          onClick={() => onClick(item.value)}
          onKeyDown={onKeyDown}
          className={`relative flex ${sizeClass} items-center justify-center rounded-md transition-all duration-150 ${
            isActive
              ? `bg-accent text-accent-foreground ${indicatorClass}`
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          aria-label={item.label}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon className={iconSize} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} className="text-xs">
        {item.label}
      </TooltipContent>
    </Tooltip>
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
  const {
    groups,
    loading,
    error,
    load,
    search,
    setSearch,
    pinnedKeys,
    togglePin,
    deleteSession,
    renameSession,
  } = useSessionHistory(client, status, agentId);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    void loadRef.current();
  }, [agentId, status]);

  const navContainerRef = useRef<HTMLDivElement>(null);

  const handleRename = useCallback(
    (key: string, name: string) => void renameSession(key, name),
    [renameSession],
  );
  const handleDelete = useCallback(
    (key: string) => void deleteSession(key),
    [deleteSession],
  );
  const handleRetry = useCallback(() => void load(), [load]);

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

  /* ── Single shell with animated width transition ── */
  return (
    <TooltipProvider delayDuration={300}>
    <div
      className={`flex h-full flex-col bg-background/60 backdrop-blur-xl ring-1 ring-white/[0.06] shadow-[4px_0_24px_-6px_rgba(0,0,0,0.3)] transform-gpu transition-[width] duration-300 ease-out overflow-hidden ${
        collapsed ? "w-14" : "w-72"
      }`}
    >
      {collapsed ? (
        /* ── Collapsed: icon rail ── */
        <>
          <div className="flex flex-col items-center py-3 shrink-0">
            <div ref={navContainerRef} role="navigation" aria-label="Management navigation">
              {NAV_ITEMS.map((item, index) => (
                <NavIconButton
                  key={item.value}
                  item={item}
                  isActive={activeManagementTab === item.value}
                  size="md"
                  indicatorPosition="left"
                  tooltipSide="right"
                  onClick={onManagementNav}
                  onKeyDown={(e) => handleNavKeyDown(e, index)}
                />
              ))}
            </div>
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
          {/* Settings + theme toggle pinned to bottom */}
          <div className="mt-auto flex flex-col items-center gap-1 pb-3">
            <ThemeToggle />
            <NavIconButton
              item={ALL_NAV_ITEMS[ALL_NAV_ITEMS.length - 1]}
              isActive={activeManagementTab === "settings"}
              size="md"
              indicatorPosition="left"
              tooltipSide="right"
              onClick={onManagementNav}
            />
          </div>
        </>
      ) : (
        /* ── Expanded: nav icons + session history ── */
        <>
          {/* Management nav */}
          <div ref={navContainerRef} className="flex items-center gap-1 border-b border-border/20 px-2 py-2 shrink-0" role="navigation" aria-label="Management navigation">
            {NAV_ITEMS.map((item, index) => (
              <NavIconButton
                key={item.value}
                item={item}
                isActive={activeManagementTab === item.value}
                size="sm"
                indicatorPosition="bottom"
                tooltipSide="bottom"
                onClick={onManagementNav}
                onKeyDown={(e) => handleNavKeyDown(e, index)}
              />
            ))}
          </div>

          {/* Session history header */}
          <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
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
          <div className="px-3 py-2 shrink-0">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search sessions…"
            />
          </div>

          {/* Session list */}
          <SessionList
            groups={groups}
            loading={loading}
            error={error}
            search={search}
            activeSessionKey={activeSessionKey}
            pinnedKeys={pinnedKeys}
            onRetry={handleRetry}
            onSelect={onSelectSession}
            onRename={handleRename}
            onDelete={handleDelete}
            onTogglePin={togglePin}
          />

          {/* Settings + theme toggle pinned to bottom */}
          <div className="border-t border-border/20 px-2 py-2 shrink-0 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onManagementNav("settings")}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-all duration-150 ${
                    activeManagementTab === "settings"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-label="Settings"
                  aria-current={activeManagementTab === "settings" ? "page" : undefined}
                >
                  <Settings className="h-3.5 w-3.5 shrink-0" />
                  <span>Settings</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Settings
              </TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        </>
      )}
    </div>
    </TooltipProvider>
  );
});
