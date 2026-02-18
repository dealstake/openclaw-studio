"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, RefreshCw, Search, X } from "lucide-react";
import type { TranscriptEntry, TranscriptSearchResult } from "@/features/sessions/hooks/useTranscripts";
import {
  inferTranscriptType,
  TRANSCRIPT_TYPE_LABELS,
  type TranscriptType,
} from "@/features/sessions/lib/transcriptUtils";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { formatCost, formatTokens } from "@/lib/text/format";
import { SessionCard } from "./SessionCard";
import { TranscriptCard } from "./TranscriptCard";
import { SearchResultCard } from "./SearchResultCard";
import { VirtualCardList } from "./VirtualCardList";

export type SessionEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null } | null;
};

type SessionsPanelProps = {
  client: GatewayClient;
  sessions: SessionEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSessionClick?: (sessionKey: string, agentId: string | null) => void;
  activeSessionKey?: string | null;
  aggregateUsage?: { inputTokens: number; outputTokens: number; totalCost: number | null; messageCount: number } | null;
  aggregateUsageLoading?: boolean;
  cumulativeUsage?: { inputTokens: number; outputTokens: number; totalCost: number | null; messageCount: number } | null;
  cumulativeUsageLoading?: boolean;
  transcripts?: TranscriptEntry[];
  transcriptsLoading?: boolean;
  transcriptsLoadingMore?: boolean;
  transcriptsError?: string | null;
  transcriptsHasMore?: boolean;
  onTranscriptsRefresh?: () => void;
  onTranscriptsLoadMore?: () => void;
  onTranscriptClick?: (sessionId: string, agentId: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  searchResults?: TranscriptSearchResult[];
  searchLoading?: boolean;
  searchError?: string | null;
  onClearSearch?: () => void;
};

const TRANSCRIPT_CARD_HEIGHT = 88;
const SEARCH_CARD_HEIGHT = 100;

export const SessionsPanel = memo(function SessionsPanel({
  client,
  sessions,
  loading,
  error,
  onRefresh,
  onSessionClick,
  activeSessionKey = null,
  aggregateUsage = null,
  aggregateUsageLoading = false,
  cumulativeUsage = null,
  cumulativeUsageLoading = false,
  transcripts = [],
  transcriptsLoading = false,
  transcriptsLoadingMore = false,
  transcriptsError = null,
  transcriptsHasMore = false,
  onTranscriptsRefresh,
  onTranscriptsLoadMore,
  onTranscriptClick,
  searchQuery = "",
  onSearchQueryChange,
  searchResults = [],
  searchLoading = false,
  searchError = null,
  onClearSearch,
}: SessionsPanelProps) {
  const [tab, setTab] = useState<"active" | "history">("active");
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

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [sessions]
  );

  const filteredTranscripts = useMemo(() => {
    let list = transcripts;
    if (transcriptFilter !== "all") {
      list = list.filter((t) => inferTranscriptType(t) === transcriptFilter);
    }
    const sorted = [...list].sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return transcriptSortNewest ? bTime - aTime : aTime - bTime;
    });
    return sorted;
  }, [transcripts, transcriptFilter, transcriptSortNewest]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
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

  const renderTranscriptCard = useCallback(
    (t: TranscriptEntry) => (
      <TranscriptCard
        transcript={t}
        onClick={() => onTranscriptClick?.(t.sessionId, t.sessionKey?.split(":")?.[1] ?? "")}
      />
    ),
    [onTranscriptClick]
  );

  const renderSearchCard = useCallback(
    (r: TranscriptSearchResult) => (
      <SearchResultCard
        result={r}
        query={searchQuery}
        onClick={() => onTranscriptClick?.(r.sessionId, r.sessionKey?.split(":")?.[1] ?? "")}
      />
    ),
    [onTranscriptClick, searchQuery]
  );

  const transcriptKeyExtractor = useCallback((t: TranscriptEntry) => t.sessionId, []);
  const searchKeyExtractor = useCallback((r: TranscriptSearchResult) => r.sessionId, []);

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
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
            className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
              tab === "history"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setTab("history");
              if (transcripts.length === 0 && !transcriptsLoading) {
                onTranscriptsRefresh?.();
              }
            }}
          >
            History
          </button>
        </div>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          aria-label={tab === "active" ? "Refresh sessions" : "Refresh history"}
          onClick={tab === "active" ? onRefresh : () => onTranscriptsRefresh?.()}
          disabled={tab === "active" ? loading : transcriptsLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${(tab === "active" ? loading : transcriptsLoading) ? "animate-spin" : ""}`} />
        </button>
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

      {/* ─── Active tab ─── */}
      <div className={`min-h-0 flex-1 overflow-y-auto p-4 ${tab === "active" ? "" : "hidden"}`}>
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

        {!loading && !error && sorted.length === 0 ? (
          <EmptyStatePanel title="No sessions found." compact className="p-3 text-xs" />
        ) : null}

        {sorted.length > 0 ? (
          <div className="flex flex-col gap-2">
            {sorted.map((session) => (
              <SessionCard
                key={session.key}
                session={session}
                isActive={session.key === activeSessionKey}
                isExpanded={expandedKeys.has(session.key)}
                onToggle={() => toggleExpanded(session.key)}
                onSessionClick={onSessionClick}
                client={client}
                busyKey={busyKey}
                confirmDeleteKey={confirmDeleteKey}
                onSetConfirmDelete={setConfirmDeleteKey}
                onDelete={(key) => { void handleDelete(key); }}
                onCompact={(key) => { void handleCompact(key); }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* ─── History tab ─── */}
      <div className={`min-h-0 flex-1 flex flex-col overflow-hidden ${tab === "history" ? "" : "hidden"}`}>
        {/* Search input */}
        {onSearchQueryChange ? (
          <div className="relative mx-4 mt-4 mb-3 flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              className="w-full rounded-md border border-border/80 bg-card/70 py-1.5 pl-8 pr-8 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
              placeholder="Search transcripts…"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                onClick={onClearSearch}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : null}

        {/* Search results */}
        {searchQuery.trim() ? (
          <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
            {searchError ? (
              <div className="mb-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
                {searchError}
              </div>
            ) : null}

            {searchLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[72px] animate-pulse rounded-md border border-border/50 bg-muted/20" />
                ))}
              </div>
            ) : null}

            {!searchLoading && !searchError && searchResults.length === 0 ? (
              <EmptyStatePanel title="No results found." compact className="p-3 text-xs" />
            ) : null}

            {!searchLoading && searchResults.length > 0 ? (
              <>
                <div className="mb-2 font-mono text-[9px] text-muted-foreground">
                  {searchResults.length} session{searchResults.length !== 1 ? "s" : ""} matched
                </div>
                <VirtualCardList
                  items={searchResults}
                  estimateSize={SEARCH_CARD_HEIGHT}
                  keyExtractor={searchKeyExtractor}
                  renderItem={renderSearchCard}
                />
              </>
            ) : null}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
            {/* Filter chips + sort toggle */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {(["all", "main", "cron", "subagent", "channel"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] transition ${
                    transcriptFilter === type
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/60 bg-card/70 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                  onClick={() => setTranscriptFilter(type)}
                >
                  {type === "all" ? "All" : TRANSCRIPT_TYPE_LABELS[type]}
                </button>
              ))}
              <button
                type="button"
                className="ml-auto flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:border-border hover:text-foreground"
                onClick={() => setTranscriptSortNewest((prev) => !prev)}
                aria-label={transcriptSortNewest ? "Sort oldest first" : "Sort newest first"}
              >
                {transcriptSortNewest ? <ArrowDownAZ className="h-3 w-3" /> : <ArrowUpAZ className="h-3 w-3" />}
                {transcriptSortNewest ? "Newest" : "Oldest"}
              </button>
            </div>

            {transcriptsError ? (
              <div className="mb-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
                {transcriptsError}
              </div>
            ) : null}

            {transcriptsLoading && transcripts.length === 0 ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[72px] animate-pulse rounded-md border border-border/50 bg-muted/20" />
                ))}
              </div>
            ) : null}

            {!transcriptsLoading && !transcriptsError && filteredTranscripts.length === 0 ? (
              <EmptyStatePanel
                title={transcriptFilter !== "all" ? `No ${TRANSCRIPT_TYPE_LABELS[transcriptFilter]} transcripts found.` : "No session history found."}
                compact
                className="p-3 text-xs"
              />
            ) : null}

            {filteredTranscripts.length > 0 ? (
              <>
                <div className="mb-2 font-mono text-[9px] text-muted-foreground">
                  {filteredTranscripts.length} transcript{filteredTranscripts.length !== 1 ? "s" : ""}
                  {transcriptFilter !== "all" ? ` (${TRANSCRIPT_TYPE_LABELS[transcriptFilter]})` : ""}
                </div>
                <VirtualCardList
                  items={filteredTranscripts}
                  estimateSize={TRANSCRIPT_CARD_HEIGHT}
                  keyExtractor={transcriptKeyExtractor}
                  renderItem={renderTranscriptCard}
                  onLoadMore={transcriptsHasMore ? onTranscriptsLoadMore : undefined}
                  loadingMore={transcriptsLoadingMore}
                />
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
});
