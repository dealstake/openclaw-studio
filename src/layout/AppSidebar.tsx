"use client";

import { memo, useCallback, useRef, useEffect, useState } from "react";
import {
  MessageSquare,
  BarChart3,
  Radio,
  Plus,
  ChevronLeft,
  Loader2,
  AlertCircle,
  SearchX,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BottomSidebarActions } from "@/components/BottomSidebarActions";
import { sectionLabelClass } from "@/components/SectionLabel";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useSessionHistory } from "@/features/sessions/hooks/useSessionHistory";
import { useTranscriptSearch, useTranscripts } from "@/features/sessions/hooks/useTranscripts";
import { SessionList } from "@/features/sessions/components/SessionList";
import { SearchResultCard } from "@/features/sessions/components/SearchResultCard";
import { SessionViewToggle, type SessionView } from "@/features/sessions/components/SessionViewToggle";
import { HistorySessionList } from "@/features/sessions/components/HistorySessionList";
import { exportConversationAsMarkdown } from "@/features/sessions/lib/exportConversation";

/** Management nav items that open in expanded modal */
export type ManagementTab = "usage" | "channels" | "settings";

const NAV_ITEMS: Array<{ value: ManagementTab; label: string; icon: typeof MessageSquare }> = [
  { value: "usage", label: "Usage", icon: BarChart3 },
  { value: "channels", label: "Channels", icon: Radio },
];

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
  onViewTrace?: (sessionKey: string) => void;
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

  // Server-side search across ALL sessions (active + archived)
  const {
    setQuery: setServerSearchQuery,
    results: searchResults,
    searching,
    error: searchError,
  } = useTranscriptSearch(agentId);

  // Active/History toggle
  const [sessionView, setSessionView] = useState<SessionView>("active");

  // History transcripts (paginated)
  const {
    transcripts,
    loading: historyLoading,
    loadingMore: historyLoadingMore,
    error: historyError,
    hasMore: historyHasMore,
    totalCount: historyTotalCount,
    loadMore: historyLoadMore,
    refresh: historyRefresh,
  } = useTranscripts(agentId);

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
              onChange={handleSearchChange}
              placeholder="Search sessions…"
            />
          </div>

          {/* Active / History toggle */}
          <div className="px-3 pb-2 shrink-0">
            <SessionViewToggle value={sessionView} onChange={setSessionView} />
          </div>

          {/* Session list, search results, or history */}
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
                  <div className={`${sectionLabelClass} px-2.5 py-1.5 text-[10px]`}>
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
          ) : sessionView === "active" ? (
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
              onViewTrace={onViewTrace}
              onExport={handleExport}
            />
          ) : (
            <HistorySessionList
              transcripts={transcripts}
              loading={historyLoading}
              loadingMore={historyLoadingMore}
              error={historyError}
              hasMore={historyHasMore}
              totalCount={historyTotalCount}
              onLoadMore={historyLoadMore}
              onRefresh={historyRefresh}
              onSelect={onSelectSession}
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
