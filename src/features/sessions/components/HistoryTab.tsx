"use client";

import { memo, useCallback } from "react";
import { ArrowDownAZ, ArrowUpAZ, ScrollText } from "lucide-react";
import { SearchInput } from "@/components/SearchInput";
import { Skeleton } from "@/components/Skeleton";
import type { TranscriptEntry, TranscriptSearchResult } from "@/features/sessions/hooks/useTranscripts";
import {
  TRANSCRIPT_TYPE_LABELS,
  type TranscriptType,
} from "@/features/sessions/lib/transcriptUtils";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import { TranscriptCard } from "./TranscriptCard";
import { SearchResultCard } from "./SearchResultCard";
import { VirtualCardList } from "./VirtualCardList";

const TRANSCRIPT_CARD_HEIGHT = 88;
const SEARCH_CARD_HEIGHT = 100;

type HistoryTabProps = {
  agentId: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
  searchResults: TranscriptSearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  transcripts: TranscriptEntry[];
  filteredTranscripts: TranscriptEntry[];
  transcriptsLoading: boolean;
  transcriptsLoadingMore: boolean;
  transcriptsError: string | null;
  transcriptsHasMore: boolean;
  onLoadMore: () => void;
  transcriptFilter: TranscriptType | "all";
  onTranscriptFilterChange: (filter: TranscriptType | "all") => void;
  transcriptSortNewest: boolean;
  onToggleSort: () => void;
  onTranscriptClick?: (sessionId: string, agentId: string) => void;
};

export const HistoryTab = memo(function HistoryTab({
  agentId,
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
  searchResults,
  searchLoading,
  searchError,
  transcripts,
  filteredTranscripts,
  transcriptsLoading,
  transcriptsError,
  transcriptsLoadingMore,
  transcriptsHasMore,
  onLoadMore,
  transcriptFilter,
  onTranscriptFilterChange,
  transcriptSortNewest,
  onToggleSort,
  onTranscriptClick,
}: HistoryTabProps) {
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {agentId ? (
        <SearchInput
          value={searchQuery}
          onChange={onSearchQueryChange}
          onClear={onClearSearch}
          placeholder="Search transcripts…"
          className="mx-4 mt-4 mb-3 flex-shrink-0"
        />
      ) : null}

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
              <div className="mb-2 font-mono text-[10px] text-muted-foreground">
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
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition focus-ring ${
                  transcriptFilter === type
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/60 bg-card/70 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
                onClick={() => onTranscriptFilterChange(type)}
              >
                {type === "all" ? "All" : TRANSCRIPT_TYPE_LABELS[type]}
              </button>
            ))}
            <button
              type="button"
              className="ml-auto flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition focus-ring hover:border-border hover:text-foreground"
              onClick={onToggleSort}
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
                <div key={i} className="flex flex-col gap-2 rounded-md border border-border/50 p-3">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : null}

          {!transcriptsLoading && !transcriptsError && filteredTranscripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <ScrollText className="h-5 w-5" />
              <p className="text-xs">
                {transcriptFilter !== "all"
                  ? `No ${TRANSCRIPT_TYPE_LABELS[transcriptFilter]} transcripts found.`
                  : "No session history found."}
              </p>
            </div>
          ) : null}

          {filteredTranscripts.length > 0 ? (
            <>
              <div className="mb-2 font-mono text-[10px] text-muted-foreground">
                {filteredTranscripts.length} transcript{filteredTranscripts.length !== 1 ? "s" : ""}
                {transcriptFilter !== "all" ? ` (${TRANSCRIPT_TYPE_LABELS[transcriptFilter]})` : ""}
              </div>
              <VirtualCardList
                items={filteredTranscripts}
                estimateSize={TRANSCRIPT_CARD_HEIGHT}
                keyExtractor={transcriptKeyExtractor}
                renderItem={renderTranscriptCard}
                onLoadMore={transcriptsHasMore ? onLoadMore : undefined}
                loadingMore={transcriptsLoadingMore}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
});
