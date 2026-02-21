"use client";

import { memo } from "react";
import { SearchInput } from "@/components/SearchInput";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { SessionEntry } from "./SessionsPanel";
import { SessionCard } from "./SessionCard";

type ActiveSessionsTabProps = {
  sessions: SessionEntry[];
  loading: boolean;
  error: string | null;
  actionError: string | null;
  activeSearch: string;
  onActiveSearchChange: (value: string) => void;
  activeSessionKey: string | null;
  expandedKeys: Set<string>;
  onToggleExpanded: (key: string) => void;
  onSessionClick?: (sessionKey: string, agentId: string | null) => void;
  onViewTrace?: (sessionKey: string, agentId: string | null) => void;
  client: GatewayClient;
  busyKey: string | null;
  confirmDeleteKey: string | null;
  onSetConfirmDelete: (key: string | null) => void;
  onDelete: (key: string) => void;
  onCompact: (key: string) => void;
};

export const ActiveSessionsTab = memo(function ActiveSessionsTab({
  sessions,
  loading,
  error,
  actionError,
  activeSearch,
  onActiveSearchChange,
  activeSessionKey,
  expandedKeys,
  onToggleExpanded,
  onSessionClick,
  onViewTrace,
  client,
  busyKey,
  confirmDeleteKey,
  onSetConfirmDelete,
  onDelete,
  onCompact,
}: ActiveSessionsTabProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <SearchInput
        value={activeSearch}
        onChange={onActiveSearchChange}
        placeholder="Search active sessions…"
        className="mb-3 flex-shrink-0"
      />

      {error || actionError ? (
        <div className="mb-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
          {error ?? actionError}
        </div>
      ) : null}

      {loading && sessions.length === 0 ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-md border border-border/50 bg-muted/20" />
          ))}
        </div>
      ) : null}

      {!loading && !error && sessions.length === 0 ? (
        <EmptyStatePanel title={activeSearch ? "No matching sessions." : "No sessions found."} compact className="p-3 text-xs" />
      ) : null}

      {sessions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {sessions.map((session) => (
            <SessionCard
              key={session.key}
              session={session}
              isActive={session.key === activeSessionKey}
              isExpanded={expandedKeys.has(session.key)}
              onToggle={() => onToggleExpanded(session.key)}
              onSessionClick={onSessionClick}
              client={client}
              busyKey={busyKey}
              confirmDeleteKey={confirmDeleteKey}
              onSetConfirmDelete={onSetConfirmDelete}
              onDelete={onDelete}
              onCompact={onCompact}
              onViewTrace={onViewTrace}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
});
