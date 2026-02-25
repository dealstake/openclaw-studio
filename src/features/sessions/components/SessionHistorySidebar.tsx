import { memo, useCallback, useEffect, useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { SearchInput } from "@/components/SearchInput";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useSessionHistory } from "../hooks/useSessionHistory";
import { sectionLabelClass } from "@/components/SectionLabel";
import { SessionList } from "./SessionList";

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

  const handleRename = useCallback(
    (key: string, name: string) => void renameSession(key, name),
    [renameSession],
  );

  const handleDelete = useCallback(
    (key: string) => void deleteSession(key),
    [deleteSession],
  );

  const handleRetry = useCallback(() => void load(), [load]);

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
      <div className="flex h-full w-10 flex-col items-center bg-background/60 backdrop-blur-xl border-r border-border/20 py-3 gap-2 transition-all duration-200">
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
    <div className="flex h-full w-[240px] flex-col bg-background/60 backdrop-blur-xl border-r border-border/20">
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
          onChange={setSearch}
          placeholder="Search sessions…"
        />
        {search.trim() && (
          <p className="mt-1 px-1 text-[10px] text-muted-foreground">
            {totalFiltered} of {totalCount} sessions
          </p>
        )}
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
    </div>
  );
});
