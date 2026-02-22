import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, MessageSquare, ChevronLeft, ChevronRight, SearchX, Pin } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { SearchInput } from "@/components/SearchInput";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelativeTime } from "@/lib/text/time";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useSessionHistory, type SessionHistoryEntry } from "../hooks/useSessionHistory";
import { sectionLabelClass } from "@/components/SectionLabel";
import { SessionItemMenu } from "./SessionItemMenu";
import { highlightMatch } from "../lib/highlightMatch";

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

// --- Inline rename input ---

const InlineRenameInput = memo(function InlineRenameInput({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        const trimmed = value.trim();
        if (trimmed && trimmed !== initialValue) onSave(trimmed);
        else onCancel();
      } else if (e.key === "Escape") {
        onCancel();
      }
    },
    [value, initialValue, onSave, onCancel],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      className="w-full rounded border border-primary/40 bg-card px-1 py-0 text-[13px] font-medium leading-tight text-foreground outline-none ring-1 ring-primary/20"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
    />
  );
});

// --- Session item ---

const SessionItem = memo(function SessionItem({
  session,
  active,
  focused,
  pinned,
  renaming,
  searchQuery,
  onSelect,
  onRename,
  onRenameStart,
  onRenameCancel,
  onDelete,
  onTogglePin,
}: {
  session: SessionHistoryEntry;
  active: boolean;
  focused: boolean;
  pinned: boolean;
  renaming: boolean;
  searchQuery: string;
  onSelect: (key: string) => void;
  onRename: (key: string, name: string) => void;
  onRenameStart: (key: string) => void;
  onRenameCancel: () => void;
  onDelete: (key: string) => void;
  onTogglePin: (key: string) => void;
}) {
  const itemRef = useRef<HTMLButtonElement>(null);
  const handleClick = useCallback(() => onSelect(session.key), [onSelect, session.key]);
  const handleDoubleClick = useCallback(() => onRenameStart(session.key), [onRenameStart, session.key]);
  const handleRenameSave = useCallback(
    (name: string) => onRename(session.key, name),
    [onRename, session.key],
  );

  useEffect(() => {
    if (focused) itemRef.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  return (
    <button
      ref={itemRef}
      type="button"
      role="option"
      aria-selected={active}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-all duration-200 focus-ring min-h-[44px] ${
        active
          ? "bg-accent text-accent-foreground"
          : focused
            ? "bg-muted/70 text-foreground ring-1 ring-primary/30"
            : "text-foreground/80 hover:bg-muted hover:translate-x-0.5"
      }`}
    >
      {pinned ? (
        <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
      ) : (
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        {renaming ? (
          <InlineRenameInput
            initialValue={session.displayName}
            onSave={handleRenameSave}
            onCancel={onRenameCancel}
          />
        ) : (
          <p className="truncate text-[13px] font-medium leading-tight">
            {highlightMatch(session.displayName, searchQuery)}
          </p>
        )}
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {formatRelativeTime(session.updatedAt)}
          {session.messageCount > 0 ? ` · ${session.messageCount} msgs` : ""}
        </p>
      </div>
      {!renaming && (
        <div className="mt-0.5 shrink-0">
          <SessionItemMenu
            sessionKey={session.key}
            displayName={session.displayName}
            pinned={pinned}
            onRename={onRenameStart}
            onDelete={onDelete}
            onTogglePin={onTogglePin}
          />
        </div>
      )}
    </button>
  );
});

// --- Sidebar ---

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

  // Reset focus when search changes — wrap setSearch to also reset focus
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

  // Recent sessions for collapsed strip (top 3 non-pinned)
  const recentForCollapsed = useMemo(() => {
    const all = groups.flatMap((g) => g.sessions);
    return all.slice(0, 3);
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
