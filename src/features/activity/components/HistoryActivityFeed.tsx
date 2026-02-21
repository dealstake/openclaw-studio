"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { CompactActivityCard } from "./CompactActivityCard";
import { ExpandedTranscriptView } from "./ExpandedTranscriptView";
import type { ActivityEvent } from "../lib/activityTypes";
import type { ActivityStatus as CardStatus } from "./CompactActivityCard";
import type { MessagePart } from "@/lib/chat/types";
import { formatDuration } from "@/lib/text/time";
import { formatTokens } from "@/lib/text/format";

// ── Task Emoji Map ─────────────────────────────────────────────────────

const TASK_EMOJI: Record<string, string> = {
  "Project Continuation": "⚡",
  "Codebase Auditor": "🔍",
  "Product Research": "🔬",
  "Gateway Health": "🏥",
  "Visual QA": "👁",
};

function getTaskEmoji(taskName: string): string {
  for (const [key, emoji] of Object.entries(TASK_EMOJI)) {
    if (taskName.includes(key)) return emoji;
  }
  return "🤖";
}

function toCardStatus(status: string): CardStatus {
  if (status === "success") return "completed";
  if (status === "error") return "error";
  if (status === "partial") return "partial";
  return "completed";
}

function formatElapsed(durationMs?: number): string | undefined {
  if (!durationMs) return undefined;
  return formatDuration(durationMs);
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Types ──────────────────────────────────────────────────────────────

interface HistoryActivityFeedProps {
  agentId: string | null;
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────

export const HistoryActivityFeed = React.memo(function HistoryActivityFeed({
  agentId,
  className,
}: HistoryActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedParts, setExpandedParts] = useState<MessagePart[] | null>(null);
  const loadingRef = useRef(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const loadEvents = useCallback(async () => {
    if (!agentId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        agentId,
        limit: "100",
        offset: "0",
      });
      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [agentId]);

  const loadRef = useRef(loadEvents);
  loadRef.current = loadEvents;

  useEffect(() => {
    void loadRef.current();
  }, [agentId]);

  const handleExpand = useCallback((event: ActivityEvent) => {
    if (expandedId === event.id) {
      setExpandedId(null);
      setExpandedParts(null);
      return;
    }
    setExpandedId(event.id);
    // If we have transcript JSON, parse it
    if (event.transcriptJson) {
      try {
        const parsed = JSON.parse(event.transcriptJson) as MessagePart[];
        setExpandedParts(parsed);
      } catch {
        setExpandedParts(null);
      }
    } else {
      setExpandedParts(null);
    }
  }, [expandedId]);

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((index: number) => {
      return expandedId === events[index]?.id ? 320 : 52;
    }, [expandedId, events]),
    overscan: 5,
  });

  // Re-measure when expanded item changes
  useEffect(() => {
    virtualizer.measure();
  }, [expandedId, virtualizer]);

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading history…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">{error}</span>
        </div>
        <button
          type="button"
          onClick={() => void loadEvents()}
          className="flex items-center gap-1 text-xs text-primary-text transition-colors hover:underline"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        No activity history yet
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs text-muted-foreground">{total} events</span>
        <button
          type="button"
          onClick={() => void loadEvents()}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          Refresh
        </button>
      </div>
      <div ref={parentRef} className="flex-1 overflow-y-auto" style={{ height: "calc(100% - 28px)" }}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const event = events[virtualItem.index];
            const isExpanded = expandedId === event.id;
            const tokens = event.tokensIn || event.tokensOut
              ? formatTokens((event.tokensIn ?? 0) + (event.tokensOut ?? 0))
              : event.meta?.tokensIn || event.meta?.tokensOut
                ? formatTokens((event.meta.tokensIn ?? 0) + (event.meta.tokensOut ?? 0))
                : undefined;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="px-2 py-0.5">
                  <CompactActivityCard
                    icon={getTaskEmoji(event.taskName)}
                    title={event.taskName}
                    subtitle={event.summary}
                    status={toCardStatus(event.status)}
                    elapsed={formatElapsed(event.meta?.durationMs)}
                    badge={tokens ?? undefined}
                    onExpand={() => handleExpand(event)}
                  />
                  {isExpanded && (
                    <div className="mt-1 rounded-lg border border-border bg-card/30 overflow-hidden" style={{ height: 260 }}>
                      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(event.timestamp)}
                        </span>
                        {event.model && (
                          <span className="text-[10px] text-muted-foreground/60">{event.model}</span>
                        )}
                        {event.projectName && (
                          <span className="text-[10px] font-medium text-primary-text/70">{event.projectName}</span>
                        )}
                      </div>
                      <div style={{ height: 230 }}>
                        {expandedParts ? (
                          <ExpandedTranscriptView parts={expandedParts} />
                        ) : event.sessionKey ? (
                          <ExpandedTranscriptView
                            agentId={agentId ?? undefined}
                            sessionId={event.sessionKey.split(":").pop()}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                            No transcript available for this run
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
