import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, MessageSquare, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { SearchInput } from "@/components/SearchInput";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useSessionHistory } from "../hooks/useSessionHistory";
import { sectionLabelClass } from "@/components/SectionLabel";
import { SessionItem } from "./SessionItem";

/** Maximum recent sessions shown in collapsed strip. */
const COLLAPSED_RECENT_COUNT = 3;

type SessionHistorySidebarProps = {
  client: GatewayClient;
  status: GatewayStatus;
  agentId: string | null;
  activeSessionKey: string | null;
  onSelectSession: (sessionKey: string) => void;
  onNewSession: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export const SessionHistorySidebar = memo(function SessionHistorySidebar({
  client,
  status,
  agentId,
  activeSessionKey,
  onSelectSession,
  onNewSession,
  collapsed,
  onToggleCollapse,
}: SessionHistorySidebarProps) {
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
    totalFiltered,
    totalCount,
  } = useSessionHistory(client, status, agentId);

  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Flat list of all visible session keys for keyboard navigation
  const flatKeys = useMemo(
    () => groups.flatMap((g) => g.sessions.map((s) => s.key)),
    [groups],
  );

  // Reset focus when search changes
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setFocusedIndex(-1);
    },
    [setSearch],
  );

  const handleRenameStart = useCallback((key: string) => {
    setRenamingKey(key);
  }, []);

  const handleRenameCancel = useCallback(() => {
    setRenamingKey(null);
  }, []);

  const handleRename = useCallback(
    (key: string, name: string) => {
      void renameSession(key, name);
      setRenamingKey(null);
    },
    [renameSession],
  );

  const handleDelete = useCallback(
    (key: string) => {
      void deleteSession(key);
    },
    [deleteSession],
  );

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (renamingKey) return;
      const len = flatKeys.length;
      if (!len) return;

      let next = focusedIndex;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          next = focusedIndex < len - 1 ? focusedIndex + 1 : 0;
          break;
        case "ArrowUp":
          e.preventDefault();
          next = focusedIndex > 0 ? focusedIndex - 1 : len - 1;
          break;
        case "Home":
          e.preventDefault();
          next = 0;
          break;
        case "End":
          e.preventDefault();
          next = len - 1;
          break;
        case "Enter":
          if (focusedIndex >= 0 && focusedIndex < len) {
            e.preventDefault();
            onSelectSession(flatKeys[focusedIndex]);
          }
          return;
        default:
          return;
      }
      setFocusedIndex(next);
    },
    [flatKeys, focusedIndex, renamingKey, onSelectSession],
  );

  // Load on mount and when agentId changes
  useEffect(() => {
    void load();
  }, [load]);

  // Recent sessions for collapsed strip
  const recentForCollapsed = useMemo(() => {
    const all = groups.flatMap((g) => g.sessions);
    return all.slice(0, COLLAPSED_RECENT_COUNT);
  }, [groups]);

  if (collapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center bg-background/60 backdrop-blur-xl ring-1 ring-white/[0.06] py-3 gap-2 transition-all duration-200">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Expand session history"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-2 flex flex-col items-center gap-1.5">
          {recentForCollapsed.map((s) => {
            const initials = s.displayName
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("");
            return (
              <Tooltip key={s.key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleCollapse();
                      onSelectSession(s.key);
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-[9px] font-semibold transition-colors ${
                      s.key === activeSessionKey
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    {initials || "?"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {s.displayName}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[240px] flex-col bg-background/60 backdrop-blur-xl ring-1 ring-white/[0.06] shadow-[4px_0_24px_-6px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Collapse session history"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className={`${sectionLabelClass} flex-1`}>Sessions</span>
        <button
          type="button"
          onClick={onNewSession}
          className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          aria-label="New session"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search sessions…"
        />
        {search.trim() && (
          <p className="mt-1 px-1 text-[10px] text-muted-foreground">
            {totalFiltered} of {totalCount} sessions
          </p>
        )}
      </div>

      {/* Session list */}
      <div
        className="flex-1 overflow-y-auto px-1.5 pb-2"
        role="listbox"
        aria-label="Session history"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
      >
        {error ? (
          <div className="px-1.5">
            <ErrorBanner message={error} onRetry={() => void load()} />
          </div>
        ) : null}
        {loading && groups.length === 0 ? (
          <CardSkeleton count={4} variant="compact" className="px-1" />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={search ? SearchX : MessageSquare}
            title={search ? "No matching sessions" : "No sessions yet"}
            description={search ? undefined : "Start chatting to see your session history here"}
            className="py-8"
          />
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
                    focused={flatKeys[focusedIndex] === session.key}
                    pinned={pinnedKeys.has(session.key)}
                    renaming={renamingKey === session.key}
                    searchQuery={search}
                    onSelect={onSelectSession}
                    onRename={handleRename}
                    onRenameStart={handleRenameStart}
                    onRenameCancel={handleRenameCancel}
                    onDelete={handleDelete}
                    onTogglePin={togglePin}
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
