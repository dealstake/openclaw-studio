"use client";

import { memo, useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  MessageSquare,
  BarChart3,
  Radio,
  KeyRound,
  Cpu,
  Settings2,
  Users,
  Volume2,
  Plus,
  ChevronLeft,
  Loader2,
  AlertCircle,
  SearchX,
  ThumbsDown,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BottomSidebarActions } from "@/components/BottomSidebarActions";
import { sectionLabelClass } from "@/components/SectionLabel";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useSessionHistory } from "@/features/sessions/hooks/useSessionHistory";
import { useTranscriptSearch } from "@/features/sessions/hooks/useTranscripts";
import { SessionList } from "@/features/sessions/components/SessionList";
import { SearchResultCard } from "@/features/sessions/components/SearchResultCard";
import { exportConversationAsMarkdown } from "@/features/sessions/lib/exportConversation";
import { useComparisonStore, toggleComparison } from "@/features/sessions/state/comparisonStore";
import { useFeedbackFilter } from "@/features/feedback/hooks/useFeedbackFilter";

/** Management nav items that open in expanded modal */
export type ManagementTab = "usage" | "channels" | "credentials" | "models" | "gateway" | "settings" | "contacts" | "voice";

const NAV_ITEMS: Array<{ value: ManagementTab; label: string; icon: typeof MessageSquare }> = [
  { value: "usage", label: "Usage", icon: BarChart3 },
  { value: "channels", label: "Channels", icon: Radio },
  { value: "credentials", label: "Credentials", icon: KeyRound },
  { value: "models", label: "Models", icon: Cpu },
  { value: "gateway", label: "Gateway", icon: Settings2 },
  { value: "contacts", label: "Contacts", icon: Users },
  { value: "voice", label: "Voice", icon: Volume2 },
];

/* ─── Shared nav icon button ─── */
type NavIconButtonProps = {
  item: { value: ManagementTab; label: string; icon: typeof MessageSquare };
  isActive: boolean;
  size: "sm" | "md";
  tooltipSide: "right" | "bottom";
  onClick: (tab: ManagementTab) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
};

const NavIconButton = memo(function NavIconButton({
  item,
  isActive,
  size,
  tooltipSide,
  onClick,
  onKeyDown,
}: NavIconButtonProps) {
  const Icon = item.icon;
  // sm (expanded row): h-10 w-10 = 40px — 6 items × 40 + 5 gaps × 4 + 16 pad = 276px < w-72 (288px)
  // md (collapsed rail): h-11 w-11 = 44px — fine in the narrow icon column
  const sizeClass = size === "sm" ? "h-10 w-10" : "h-11 w-11";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-nav-item
          onClick={() => onClick(item.value)}
          onKeyDown={onKeyDown}
          className={`relative flex ${sizeClass} items-center justify-center rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
            isActive
              ? "bg-primary/15 text-primary ring-1 ring-primary/25 shadow-sm dark:bg-primary/20"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
  onViewTrace?: (sessionKey: string) => void;
  onViewReplay?: (sessionKey: string) => void;
  onResume?: (sessionId: string) => void;
  onViewForkTree?: (sessionKey: string) => void;
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
  onViewTrace,
  onViewReplay,
  onResume,
  onViewForkTree,
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
  } = useSessionHistory(client, status, agentId, activeSessionKey);

  const { comparisonSessionKeys } = useComparisonStore();
  const comparisonKeysSet = useMemo(
    () => new Set(comparisonSessionKeys),
    [comparisonSessionKeys],
  );

  const { filterGroups, hasNegativeFeedback } = useFeedbackFilter();
  const [feedbackFilterActive, setFeedbackFilterActive] = useState(false);

  // Server-side search across ALL sessions (active + archived)
  const {
    setQuery: setServerSearchQuery,
    results: searchResults,
    searching,
    error: searchError,
  } = useTranscriptSearch(agentId);

  // Unified search handler: drives both client-side filter and server-side search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setServerSearchQuery(value);
    },
    [setSearch, setServerSearchQuery],
  );

  // Whether to show server-side search results overlay
  const showSearchResults = search.trim().length > 0 && (searching || searchResults.length > 0 || searchError);

  // Apply feedback filter when active
  const filteredGroups = feedbackFilterActive ? filterGroups(groups) : groups;

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

  const handleExport = useCallback(
    (key: string) => {
      // Find display name from groups
      const session = groups.flatMap((g) => g.sessions).find((s) => s.key === key);
      const displayName = session?.displayName ?? key;
      if (!agentId) return;
      void exportConversationAsMarkdown(agentId, key, displayName).catch((err) =>
        console.error("Export failed:", err),
      );
    },
    [agentId, groups],
  );

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
    <TooltipProvider >
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
                  tooltipSide="right"
                  onClick={onManagementNav}
                  onKeyDown={(e) => handleNavKeyDown(e, index)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="mt-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Expand sidebar"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          </div>
          {/* Notifications + Theme + Settings dropdown pinned to bottom */}
          <BottomSidebarActions
            collapsed
            onOpenSettings={() => onManagementNav("settings")}
            settingsActive={activeManagementTab === "settings"}
          />
        </>
      ) : (
        /* ── Expanded: nav icons + session history ── */
        <>
          {/* Management nav */}
          <div ref={navContainerRef} className="flex items-center gap-1 px-2 py-2 shrink-0" role="navigation" aria-label="Management navigation">
            {NAV_ITEMS.map((item, index) => (
              <NavIconButton
                key={item.value}
                item={item}
                isActive={activeManagementTab === item.value}
                size="sm"
                tooltipSide="bottom"
                onClick={onManagementNav}
                onKeyDown={(e) => handleNavKeyDown(e, index)}
              />
            ))}
          </div>

          {/* Session history header */}
          <div className="flex items-center gap-2 px-3 py-2 shrink-0">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-7 w-7 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className={`${sectionLabelClass} flex-1`}>Sessions</span>
            <button
              type="button"
              onClick={onNewSession}
              className="flex h-7 w-7 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
              aria-label="New session"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Search + feedback filter */}
          <div className="px-3 py-2 shrink-0 flex items-center gap-1.5">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search sessions…"
              className="flex-1"
            />
            {hasNegativeFeedback && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setFeedbackFilterActive((v) => !v)}
                    className={`flex h-8 w-8 min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors ${
                      feedbackFilterActive
                        ? "bg-destructive/15 text-destructive"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    aria-label="Filter sessions with negative feedback"
                    aria-pressed={feedbackFilterActive}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {feedbackFilterActive ? "Show all sessions" : "Show flagged sessions"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Session list or search results */}
          {showSearchResults ? (
            <div
              className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2"
              role="region"
              aria-label="Search results"
              aria-live="polite"
            >
              {searching && searchResults.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Searching…</span>
                </div>
              ) : searchError ? (
                <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                  <AlertCircle className="h-5 w-5 text-destructive/70" />
                  <p className="text-xs text-muted-foreground">{searchError}</p>
                  <button
                    type="button"
                    onClick={() => setServerSearchQuery(search)}
                    className="text-xs text-primary hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : searchResults.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No results found"
                  description="Try a different search term"
                  className="py-8"
                />
              ) : (
                <>
                  <div className={`${sectionLabelClass} px-2.5 py-1.5`}>
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                    {searching && <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin" />}
                  </div>
                  <div className="flex flex-col gap-1.5 px-1" role="listbox" aria-label="Search results list">
                    {searchResults.map((result) => (
                      <SearchResultCard
                        key={result.sessionId}
                        result={result}
                        query={search}
                        onClick={() => {
                          const key = result.sessionKey ?? result.sessionId;
                          onSelectSession(key);
                          handleSearchChange("");
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <SessionList
              groups={filteredGroups}
              loading={loading}
              error={error}
              search={search}
              activeSessionKey={activeSessionKey}
              pinnedKeys={pinnedKeys}
              comparisonKeys={comparisonKeysSet}
              onRetry={handleRetry}
              onSelect={onSelectSession}
              onRename={handleRename}
              onDelete={handleDelete}
              onTogglePin={togglePin}
              onViewTrace={onViewTrace}
              onViewReplay={onViewReplay}
              onExport={handleExport}
              onResume={onResume}
              onToggleCompare={toggleComparison}
              onViewForkTree={onViewForkTree}
            />
          )}

          {/* Notifications + Theme + Settings dropdown pinned to bottom */}
          <BottomSidebarActions
            collapsed={false}
            onOpenSettings={() => onManagementNav("settings")}
            settingsActive={activeManagementTab === "settings"}
          />
        </>
      )}
    </div>
    </TooltipProvider>
  );
});
