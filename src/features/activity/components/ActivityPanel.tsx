"use client";

import { memo, useMemo, useState } from "react";
import { Activity, Radio, History } from "lucide-react";
import { sectionLabelClass } from "@/components/SectionLabel";
import { useActivityMessageStore } from "@/features/activity/hooks/useActivityMessageStore";
import { LiveActivityFeed } from "./LiveActivityFeed";
import { HistoryFeed } from "./HistoryFeed";

// ── Types ──────────────────────────────────────────────────────────────

type ActivityTab = "live" | "history";

// ── Main Panel ─────────────────────────────────────────────────────────

/**
 * ActivityPanel — Context panel tab for real-time activity feed.
 * Renders heartbeat, cron, sub-agent, and system events as a unified timeline
 * with expandable rich content (markdown, thinking blocks, tool calls).
 *
 * Decomposed: sub-components live in sibling files.
 * - LiveActivityFeed — virtualized live timeline
 * - HistoryFeed — virtualized paginated history
 * - ActivityMessageCard — single live message card
 * - HistoryEventCard — single history event card
 * - MessagePartsRenderer — rich message part rendering
 */
export const ActivityPanel = memo(function ActivityPanel() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("live");
  const { messages: activityMessages } = useActivityMessageStore();

  const timeline = useMemo(() => {
    const sorted = [...activityMessages];
    sorted.sort((a, b) => {
      const aRunning = a.status === "streaming";
      const bRunning = b.status === "streaming";
      if (aRunning && !bRunning) return -1;
      if (!aRunning && bRunning) return 1;
      return b.timestamp - a.timestamp;
    });
    return sorted;
  }, [activityMessages]);

  const runningCount = useMemo(
    () => timeline.filter((e) => e.status === "streaming").length,
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
          <LiveActivityFeed timeline={timeline} />
        )
      ) : (
        <HistoryFeed />
      )}
    </div>
  );
});
