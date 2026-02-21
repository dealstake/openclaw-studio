import { memo, useCallback, useEffect } from "react";
import { Plus, Search, MessageSquare, ChevronLeft } from "lucide-react";
import { formatRelativeTime } from "@/lib/text/time";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useSessionHistory, type SessionHistoryEntry } from "../hooks/useSessionHistory";
import { sectionLabelClass } from "@/components/SectionLabel";

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
      className={`group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors min-h-[44px] ${
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
  const { groups, loading, load, search, setSearch } = useSessionHistory(client, status, agentId);

  // Load on mount and when agentId changes
  useEffect(() => {
    void load();
  }, [load]);

  if (collapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center bg-background/60 backdrop-blur-xl ring-1 ring-white/[0.06] py-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Expand session history"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
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
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Collapse session history"
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
