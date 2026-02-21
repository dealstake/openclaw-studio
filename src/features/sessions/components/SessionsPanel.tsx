"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranscripts, useTranscriptSearch } from "@/features/sessions/hooks/useTranscripts";
import {
  inferTranscriptType,
  type TranscriptType,
} from "@/features/sessions/lib/transcriptUtils";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { UsageByType } from "@/features/sessions/hooks/useAllSessions";
import { formatCost, formatTokens } from "@/lib/text/format";
import { PanelIconButton } from "@/components/PanelIconButton";
import { sectionLabelClass } from "@/components/SectionLabel";
import { ActiveSessionsTab } from "./ActiveSessionsTab";
import { HistoryTab } from "./HistoryTab";

export type SessionEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null } | null;
};

type SessionsPanelProps = {
  client: GatewayClient;
  agentId: string | null;
  sessions: SessionEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSessionClick?: (sessionKey: string, agentId: string | null) => void;
  onViewTrace?: (sessionKey: string, agentId: string | null) => void;
  activeSessionKey?: string | null;
  aggregateUsage?: { inputTokens: number; outputTokens: number; totalCost: number | null; messageCount: number } | null;
  aggregateUsageLoading?: boolean;
  cumulativeUsage?: { inputTokens: number; outputTokens: number; totalCost: number | null; messageCount: number } | null;
  cumulativeUsageLoading?: boolean;
  usageByType?: UsageByType | null;
  onTranscriptClick?: (sessionId: string, agentId: string) => void;
};

export const SessionsPanel = memo(function SessionsPanel({
  client,
  agentId,
  sessions,
  loading,
  error,
  onRefresh,
  onSessionClick,
  onViewTrace,
  activeSessionKey = null,
  aggregateUsage = null,
  aggregateUsageLoading = false,
  cumulativeUsage = null,
  cumulativeUsageLoading = false,
  usageByType = null,
  onTranscriptClick,
}: SessionsPanelProps) {
  const {
    transcripts,
    loading: transcriptsLoading,
    loadingMore: transcriptsLoadingMore,
    error: transcriptsError,
    hasMore: transcriptsHasMore,
    loadMore: transcriptsLoadMore,
    refresh: transcriptsRefresh,
  } = useTranscripts(agentId);

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    searching: searchLoading,
    error: searchError,
    clearSearch,
  } = useTranscriptSearch(agentId);

  const [tab, setTab] = useState<"active" | "history">("active");
  const [activeSearch, setActiveSearch] = useState("");
  const [transcriptFilter, setTranscriptFilter] = useState<TranscriptType | "all">("all");
  const [transcriptSortNewest, setTranscriptSortNewest] = useState(true);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    return activeSessionKey ? new Set([activeSessionKey]) : new Set();
  });

  useEffect(() => {
    if (activeSessionKey) {
      setExpandedKeys((prev) => {
        if (prev.has(activeSessionKey)) return prev;
        const next = new Set(prev);
        next.add(activeSessionKey);
        return next;
      });
    }
  }, [activeSessionKey]);

  const filteredSorted = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    if (!activeSearch.trim()) return sorted;
    const q = activeSearch.toLowerCase();
    return sorted.filter((s) => {
      const name = (s.displayName ?? s.key).toLowerCase();
      return name.includes(q);
    });
  }, [sessions, activeSearch]);

  const filteredTranscripts = useMemo(() => {
    let list = transcripts;
    if (transcriptFilter !== "all") {
      list = list.filter((t) => inferTranscriptType(t) === transcriptFilter);
    }
    return [...list].sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return transcriptSortNewest ? bTime - aTime : aTime - bTime;
    });
  }, [transcripts, transcriptFilter, transcriptSortNewest]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleDelete = useCallback(
    async (key: string) => {
      setBusyKey(key);
      setActionError(null);
      try {
        await client.call("sessions.delete", { key });
        setConfirmDeleteKey(null);
        onRefresh();
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          const message = err instanceof Error ? err.message : "Failed to delete session.";
          setActionError(message);
        }
      } finally {
        setBusyKey(null);
      }
    },
    [client, onRefresh]
  );

  const handleCompact = useCallback(
    async (key: string) => {
      setBusyKey(key);
      setActionError(null);
      try {
        await client.call("sessions.compact", { key });
        onRefresh();
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          const message = err instanceof Error ? err.message : "Failed to compact session.";
          setActionError(message);
        }
      } finally {
        setBusyKey(null);
      }
    },
    [client, onRefresh]
  );

  const handleDeleteVoid = useCallback((key: string) => { void handleDelete(key); }, [handleDelete]);
  const handleCompactVoid = useCallback((key: string) => { void handleCompact(key); }, [handleCompact]);
  const handleToggleSort = useCallback(() => setTranscriptSortNewest((prev) => !prev), []);

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      {/* Tab header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`rounded-md px-2 py-1 ${sectionLabelClass} transition ${
              tab === "active"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("active")}
          >
            Active
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 ${sectionLabelClass} transition ${
              tab === "history"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setTab("history");
              if (transcripts.length === 0 && !transcriptsLoading) {
                transcriptsRefresh();
              }
            }}
          >
            History
          </button>
        </div>
        <PanelIconButton
          aria-label={tab === "active" ? "Refresh sessions" : "Refresh history"}
          onClick={tab === "active" ? onRefresh : () => transcriptsRefresh()}
          disabled={tab === "active" ? loading : transcriptsLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${(tab === "active" ? loading : transcriptsLoading) ? "animate-spin" : ""}`} />
        </PanelIconButton>
      </div>

      {/* Usage summary (active tab only) */}
      {tab === "active" && (cumulativeUsage || aggregateUsage || cumulativeUsageLoading || aggregateUsageLoading) ? (
        <div className="flex flex-col gap-1.5 border-b border-border/40 px-4 py-2.5">
          {cumulativeUsage && (cumulativeUsage.inputTokens + cumulativeUsage.outputTokens) > 0 ? (
            <div className="flex flex-col gap-1">
              <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                All Sessions
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span className="font-semibold text-foreground">
                  {formatTokens(cumulativeUsage.inputTokens + cumulativeUsage.outputTokens)} tokens
                </span>
                {cumulativeUsage.totalCost !== null ? (
                  <span className="font-semibold text-foreground">{formatCost(cumulativeUsage.totalCost, "USD")}</span>
                ) : null}
                {cumulativeUsage.messageCount > 0 ? (
                  <span className="text-muted-foreground">{cumulativeUsage.messageCount.toLocaleString()} messages</span>
                ) : null}
              </div>
              {usageByType ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/80">
                  {usageByType.cron > 0 ? <span>{formatTokens(usageByType.cron)} cron</span> : null}
                  {usageByType.main > 0 ? <span>{formatTokens(usageByType.main)} main</span> : null}
                  {usageByType.subagent > 0 ? <span>{formatTokens(usageByType.subagent)} sub-agent</span> : null}
                  {usageByType.channel > 0 ? <span>{formatTokens(usageByType.channel)} channel</span> : null}
                  {usageByType.unknown > 0 ? <span>{formatTokens(usageByType.unknown)} other</span> : null}
                </div>
              ) : null}
            </div>
          ) : cumulativeUsageLoading ? (
            <div className="h-8 w-48 animate-pulse rounded bg-muted/30" />
          ) : null}
          {aggregateUsage ? (
            <div className="flex flex-col gap-0.5">
              <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Current Session
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/80">
                <span>
                  {formatTokens(aggregateUsage.inputTokens + aggregateUsage.outputTokens)} tokens
                </span>
                {aggregateUsage.totalCost !== null ? (
                  <span>{formatCost(aggregateUsage.totalCost, "USD")}</span>
                ) : null}
                <span>{aggregateUsage.messageCount.toLocaleString()} messages</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Active tab */}
      <div className={tab === "active" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
        <ActiveSessionsTab
          sessions={filteredSorted}
          loading={loading}
          error={error}
          actionError={actionError}
          activeSearch={activeSearch}
          onActiveSearchChange={setActiveSearch}
          activeSessionKey={activeSessionKey}
          expandedKeys={expandedKeys}
          onToggleExpanded={toggleExpanded}
          onSessionClick={onSessionClick}
          onViewTrace={onViewTrace}
          client={client}
          busyKey={busyKey}
          confirmDeleteKey={confirmDeleteKey}
          onSetConfirmDelete={setConfirmDeleteKey}
          onDelete={handleDeleteVoid}
          onCompact={handleCompactVoid}
        />
      </div>

      {/* History tab */}
      <div className={tab === "history" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "hidden"}>
        <HistoryTab
          agentId={agentId}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onClearSearch={clearSearch}
          searchResults={searchResults}
          searchLoading={searchLoading}
          searchError={searchError}
          transcripts={transcripts}
          filteredTranscripts={filteredTranscripts}
          transcriptsLoading={transcriptsLoading}
          transcriptsLoadingMore={transcriptsLoadingMore}
          transcriptsError={transcriptsError}
          transcriptsHasMore={transcriptsHasMore}
          onLoadMore={transcriptsLoadMore}
          transcriptFilter={transcriptFilter}
          onTranscriptFilterChange={setTranscriptFilter}
          transcriptSortNewest={transcriptSortNewest}
          onToggleSort={handleToggleSort}
          onTranscriptClick={onTranscriptClick}
        />
      </div>
    </div>
  );
});
