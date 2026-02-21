"use client";

import { memo, useMemo, useRef, useEffect, useState } from "react";
import { Activity, Radio, History, ChevronRight } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { sectionLabelClass } from "@/components/SectionLabel";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ToolCallBlock } from "@/components/chat/ToolCallBlock";
import { useHeartbeatEntries } from "@/features/activity/hooks/useHeartbeatEntries";
import {
  useActivityMessageStore,
  type ActivityMessage,
} from "@/features/activity/hooks/useActivityMessageStore";
import type { HeartbeatEntry } from "@/features/activity/hooks/useHeartbeatEntries";
import type { MessagePart } from "@/lib/chat/types";
import {
  isTextPart,
  isReasoningPart,
  isToolInvocationPart,
} from "@/lib/chat/types";

// ── Helpers ────────────────────────────────────────────────────────────

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function taskEmoji(taskName: string): string {
  const lower = taskName.toLowerCase();
  if (lower.includes("continuation")) return "⚡";
  if (lower.includes("auditor") || lower.includes("audit")) return "🔍";
  if (lower.includes("research")) return "🔬";
  if (lower.includes("visual qa") || lower.includes("visual-qa")) return "👁";
  if (lower.includes("health") || lower.includes("gateway")) return "🏥";
  return "🤖";
}

const STATUS_COLORS: Record<string, string> = {
  running: "bg-emerald-400",
  completed: "bg-muted-foreground/30",
  error: "bg-red-400",
  streaming: "bg-emerald-400",
  complete: "bg-muted-foreground/30",
};

// ── Rich Message Parts Renderer ────────────────────────────────────────

function getTextContent(parts: MessagePart[]): string {
  return parts
    .filter(isTextPart)
    .map((p) => p.text)
    .join("\n");
}

const MessagePartsRenderer = memo(function MessagePartsRenderer({
  parts,
}: {
  parts: MessagePart[];
}) {
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (isTextPart(part) && part.text.trim()) {
          return (
            <MarkdownViewer
              key={`text-${i}`}
              content={part.text}
              className="text-xs text-foreground/90"
            />
          );
        }
        if (isReasoningPart(part)) {
          return (
            <ThinkingBlock
              key={`think-${i}`}
              text={part.text}
              streaming={part.streaming}
              startedAt={part.startedAt}
              completedAt={part.completedAt}
            />
          );
        }
        if (isToolInvocationPart(part)) {
          return (
            <ToolCallBlock
              key={`tool-${part.toolCallId}`}
              name={part.name}
              phase={part.phase}
              args={part.args}
              result={part.result}
              startedAt={part.startedAt}
              completedAt={part.completedAt}
            />
          );
        }
        return null;
      })}
    </div>
  );
});

// ── Unified timeline entry type ────────────────────────────────────────

type TimelineEntry =
  | { kind: "heartbeat"; data: HeartbeatEntry }
  | { kind: "message"; data: ActivityMessage };

function getEntryTimestamp(entry: TimelineEntry): number {
  return entry.data.timestamp;
}

function getEntryKey(entry: TimelineEntry): string {
  switch (entry.kind) {
    case "heartbeat":
      return `hb-${entry.data.runId}`;
    case "message":
      return `msg-${entry.data.sourceKey}`;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────

const HeartbeatCard = memo(function HeartbeatCard({
  entry,
}: {
  entry: HeartbeatEntry;
}) {
  const isOk = entry.status === "ok";
  return (
    <div className="group flex gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-muted/40">
      <div className="flex-shrink-0 pt-0.5 text-base leading-none">💓</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground">Heartbeat</span>
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${isOk ? "bg-emerald-400" : "bg-red-400"}`}
          />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
          {isOk ? "All clear" : entry.text.slice(0, 120)}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          {formatTime(entry.timestamp)}
        </p>
      </div>
    </div>
  );
});

const ActivityMessageCard = memo(function ActivityMessageCard({
  entry,
}: {
  entry: ActivityMessage;
}) {
  const [expanded, setExpanded] = useState(false);
  const isStreaming = entry.status === "streaming";
  const textSnippet = getTextContent(entry.parts).slice(0, 200);
  const hasRichContent =
    entry.parts.length > 1 ||
    entry.parts.some((p) => isReasoningPart(p) || isToolInvocationPart(p)) ||
    getTextContent(entry.parts).length > 200;

  return (
    <div className="group rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
      {/* Header row — always visible */}
      <div className="flex gap-2.5">
        <div className="flex-shrink-0 pt-0.5 text-base leading-none">
          {taskEmoji(entry.sourceName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground truncate">
              {entry.sourceName || "Activity"}
            </span>
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[entry.status] ?? "bg-muted-foreground/30"} ${isStreaming ? "animate-pulse" : ""}`}
            />
            {hasRichContent && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="ml-auto flex items-center gap-0.5 rounded-md px-1 py-0.5 text-muted-foreground/50 transition-colors hover:bg-muted/60 hover:text-muted-foreground"
              >
                <ChevronRight
                  size={12}
                  className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                />
                <span className="text-[10px]">{expanded ? "Less" : "More"}</span>
              </button>
            )}
          </div>

          {/* Collapsed: snippet */}
          {!expanded && textSnippet && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">
              {textSnippet}
            </p>
          )}

          {/* Expanded: full rich rendering */}
          {expanded && (
            <div className="mt-2">
              <MessagePartsRenderer parts={entry.parts} />
            </div>
          )}

          <p className="mt-1 text-[10px] text-muted-foreground/60">
            {formatTime(entry.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
});

// ── Tabs ───────────────────────────────────────────────────────────────

type ActivityTab = "live" | "history";

// ── Virtualized Timeline ───────────────────────────────────────────────

const VirtualizedTimeline = memo(function VirtualizedTimeline({
  timeline,
}: {
  timeline: TimelineEntry[];
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: timeline.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  // Auto-scroll to top when new streaming entry appears
  const prevTopKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (timeline.length === 0) return;
    const topKey = getEntryKey(timeline[0]);
    if (prevTopKeyRef.current !== topKey) {
      prevTopKeyRef.current = topKey;
      virtualizer.scrollToIndex(0, { behavior: "smooth" });
    }
  }, [timeline, virtualizer]);

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const entry = timeline[virtualItem.index];
          return (
            <div
              key={getEntryKey(entry)}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              {entry.kind === "heartbeat" ? (
                <HeartbeatCard entry={entry.data} />
              ) : (
                <ActivityMessageCard entry={entry.data} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ── Main Panel ─────────────────────────────────────────────────────────

/**
 * ActivityPanel — Context panel tab for real-time activity feed.
 * Renders heartbeat, cron, sub-agent, and system events as a unified timeline
 * with expandable rich content (markdown, thinking blocks, tool calls).
 */
export const ActivityPanel = memo(function ActivityPanel() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("live");
  const heartbeatEntries = useHeartbeatEntries();
  const { messages: activityMessages } = useActivityMessageStore();

  // Build unified timeline from all sources
  const timeline = useMemo(() => {
    const entries: TimelineEntry[] = [];

    // Heartbeats (last 10)
    for (const hb of heartbeatEntries.slice(0, 10)) {
      entries.push({ kind: "heartbeat", data: hb });
    }

    // Activity messages from the unified store (cron, subagent, heartbeat, system events)
    for (const msg of activityMessages) {
      entries.push({ kind: "message", data: msg });
    }

    // Sort: streaming entries first, then by timestamp descending
    entries.sort((a, b) => {
      const aRunning = a.kind === "message" && a.data.status === "streaming";
      const bRunning = b.kind === "message" && b.data.status === "streaming";
      if (aRunning && !bRunning) return -1;
      if (!aRunning && bRunning) return 1;
      return getEntryTimestamp(b) - getEntryTimestamp(a);
    });

    return entries;
  }, [heartbeatEntries, activityMessages]);

  const runningCount = useMemo(
    () =>
      timeline.filter(
        (e) => e.kind === "message" && e.data.status === "streaming",
      ).length,
    [timeline],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border/20 px-3 pt-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("live")}
          className={`flex items-center gap-1.5 px-2.5 pb-2 ${sectionLabelClass} transition-colors focus-ring rounded-md ${
            activeTab === "live"
              ? "text-foreground font-semibold border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="h-3 w-3" />
          Live
          {runningCount > 0 && (
            <span className="ml-0.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
              {runningCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-1.5 px-2.5 pb-2 ${sectionLabelClass} transition-colors focus-ring rounded-md ${
            activeTab === "history"
              ? "text-foreground font-semibold border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-3 w-3" />
          History
        </button>
      </div>

      {/* Content */}
      {activeTab === "live" ? (
        timeline.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <Activity className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">No live activity</p>
            <p className="text-xs text-muted-foreground/60">
              Running cron jobs, heartbeats, and sub-agents appear here
            </p>
          </div>
        ) : (
          <VirtualizedTimeline timeline={timeline} />
        )
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
          <History className="h-8 w-8 opacity-30" />
          <p className="text-sm font-medium">History</p>
          <p className="text-xs text-muted-foreground/60">
            Historical activity from the database will be available in a future phase.
          </p>
        </div>
      )}
    </div>
  );
});
