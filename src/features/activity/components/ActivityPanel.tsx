"use client";

import { memo, useMemo, useRef, useEffect, useCallback, useState } from "react";
import { Activity, Radio, History } from "lucide-react";
import { sectionLabelClass } from "@/components/SectionLabel";
import { useHeartbeatEntries } from "@/features/activity/hooks/useHeartbeatEntries";
import {
  useActivityMessageStore,
  type ActivityMessage,
} from "@/features/activity/hooks/useActivityMessageStore";
import type { HeartbeatEntry } from "@/features/activity/hooks/useHeartbeatEntries";

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

// ── Unified timeline entry type ────────────────────────────────────────

type TimelineEntry =
  | { kind: "heartbeat"; data: HeartbeatEntry }
  | { kind: "message"; data: ActivityMessage };

function getEntryTimestamp(entry: TimelineEntry): number {
  switch (entry.kind) {
    case "heartbeat":
      return entry.data.timestamp;
    case "message":
      return entry.data.timestamp;
  }
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
  const isStreaming = entry.status === "streaming";
  const textContent = entry.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n")
    .slice(0, 200);

  return (
    <div className="group flex gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
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
        </div>
        {textContent && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{textContent}</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          {formatTime(entry.timestamp)}
        </p>
      </div>
    </div>
  );
});

// ── Tabs ───────────────────────────────────────────────────────────────

type ActivityTab = "live" | "history";

// ── Main Panel ─────────────────────────────────────────────────────────

/**
 * ActivityPanel — Context panel tab for real-time activity feed.
 * Renders heartbeat, cron, sub-agent, and system events as a unified timeline.
 */
export const ActivityPanel = memo(function ActivityPanel() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("live");
  const heartbeatEntries = useHeartbeatEntries();
  const { messages: activityMessages } = useActivityMessageStore();
  const scrollRef = useRef<HTMLDivElement>(null);

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

    // Sort by timestamp descending (newest first) — streaming entries always on top
    entries.sort((a, b) => {
      const aRunning = a.kind === "message" && a.data.status === "streaming";
      const bRunning = b.kind === "message" && b.data.status === "streaming";
      if (aRunning && !bRunning) return -1;
      if (!aRunning && bRunning) return 1;
      return getEntryTimestamp(b) - getEntryTimestamp(a);
    });

    return entries;
  }, [heartbeatEntries, activityMessages]);

  // Auto-scroll to top when new running entries appear
  const prevTopKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (timeline.length === 0) return;
    const topKey = getEntryKey(timeline[0]);
    if (prevTopKeyRef.current !== topKey) {
      prevTopKeyRef.current = topKey;
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [timeline]);

  const runningCount = useMemo(
    () =>
      timeline.filter(
        (e) => e.kind === "message" && e.data.status === "streaming",
      ).length,
    [timeline],
  );

  const renderEntry = useCallback((entry: TimelineEntry) => {
    switch (entry.kind) {
      case "heartbeat":
        return <HeartbeatCard key={getEntryKey(entry)} entry={entry.data} />;
      case "message":
        return <ActivityMessageCard key={getEntryKey(entry)} entry={entry.data} />;
    }
  }, []);

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
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Activity className="h-8 w-8 opacity-30" />
              <p className="text-sm font-medium">No live activity</p>
              <p className="text-xs text-muted-foreground/60">
                Running cron jobs, heartbeats, and sub-agents appear here
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 p-1.5">
              {timeline.map(renderEntry)}
            </div>
          )}
        </div>
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
