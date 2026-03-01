"use client";

import { memo, useCallback } from "react";
import { Archive, Loader2, AlertCircle, MessageSquare, Bot, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { sectionLabelClass } from "@/components/SectionLabel";
import { formatRelativeTime } from "@/lib/text/time";
import { VirtualCardList } from "./VirtualCardList";
import type { TranscriptEntry } from "../hooks/useTranscripts";

type HistorySessionListProps = {
  transcripts: TranscriptEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  onLoadMore: () => void;
  onRefresh: () => void;
  onSelect: (sessionId: string) => void;
  className?: string;
};

/** Badge for session type derived from sessionKey */
function SessionTypeBadge({ sessionKey }: { sessionKey: string | null }) {
  if (!sessionKey) return null;
  if (sessionKey.includes(":cron:")) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        <RefreshCw className="h-2.5 w-2.5" /> cron
      </span>
    );
  }
  if (sessionKey.includes(":sub:")) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        <Bot className="h-2.5 w-2.5" /> sub-agent
      </span>
    );
  }
  return null;
}

const HistoryItem = memo(function HistoryItem({
  transcript,
  onSelect,
}: {
  transcript: TranscriptEntry;
  onSelect: (sessionId: string) => void;
}) {
  const handleClick = useCallback(
    () => onSelect(transcript.sessionKey ?? transcript.sessionId),
    [onSelect, transcript.sessionKey, transcript.sessionId],
  );

  const displayName =
    transcript.sessionKey?.split(":").pop() || transcript.sessionId.slice(0, 8);
  const preview = transcript.preview;

  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onClick={handleClick}
      className="group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-all duration-200 focus-ring min-h-[44px] text-foreground/80 hover:bg-muted hover:translate-x-0.5"
    >
      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-medium leading-tight">{displayName}</p>
          <SessionTypeBadge sessionKey={transcript.sessionKey} />
        </div>
        {preview && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{preview}</p>
        )}
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {transcript.updatedAt ? formatRelativeTime(new Date(transcript.updatedAt).getTime()) : "Unknown"}
          {transcript.model ? ` · ${transcript.model}` : ""}
        </p>
      </div>
    </button>
  );
});

export const HistorySessionList = memo(function HistorySessionList({
  transcripts,
  loading,
  loadingMore,
  error,
  hasMore,
  totalCount,
  onLoadMore,
  onRefresh,
  onSelect,
  className = "",
}: HistorySessionListProps) {
  const renderItem = useCallback(
    (transcript: TranscriptEntry) => (
      <HistoryItem transcript={transcript} onSelect={onSelect} />
    ),
    [onSelect],
  );

  const keyExtractor = useCallback(
    (t: TranscriptEntry) => t.sessionId,
    [],
  );

  if (error && transcripts.length === 0) {
    return (
      <div className={`min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 ${className}`}>
        <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
          <AlertCircle className="h-5 w-5 text-destructive/70" />
          <p className="text-xs text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading && transcripts.length === 0) {
    return (
      <div className={`min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 ${className}`}>
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading history…</span>
        </div>
      </div>
    );
  }

  if (transcripts.length === 0) {
    return (
      <div className={`min-h-0 flex-1 overflow-y-auto px-1.5 pb-2 ${className}`}>
        <EmptyState
          icon={Archive}
          title="No history yet"
          description="Past conversations will appear here"
          className="py-8"
        />
      </div>
    );
  }

  return (
    <div className={`min-h-0 flex-1 px-1.5 pb-2 ${className}`} role="listbox" aria-label="Session history archive">
      {totalCount > 0 && (
        <div className={`${sectionLabelClass} px-2.5 py-1.5 text-[10px]`}>
          {totalCount} transcript{totalCount !== 1 ? "s" : ""}
          {hasMore ? "+" : ""}
        </div>
      )}
      <VirtualCardList
        items={transcripts}
        estimateSize={64}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onLoadMore={hasMore ? onLoadMore : undefined}
        loadingMore={loadingMore}
        overscan={10}
      />
    </div>
  );
});
