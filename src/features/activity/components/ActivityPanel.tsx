"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Activity, Radio, History } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
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

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tabs = Array.from(
        e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
      );
      const activeIndex = tabs.findIndex(
        (tab) => tab.getAttribute("aria-selected") === "true",
      );

      let nextIndex = -1;
      if (e.key === "ArrowRight") {
        nextIndex = (activeIndex + 1) % tabs.length;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
      }

      if (nextIndex !== -1) {
        e.preventDefault();
        tabs[nextIndex].focus();
        setActiveTab(tabs[nextIndex].id.includes("live") ? "live" : "history");
      }
    },
    [setActiveTab],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div role="tablist" aria-label="Activity view" onKeyDown={handleTabKeyDown} className="flex items-center gap-1 border-b border-border/20 px-3 py-1.5">
        <button
          type="button"
          role="tab"
          id="activity-tab-live"
          aria-selected={activeTab === "live"}
          aria-controls="activity-tabpanel-live"
          onClick={() => setActiveTab("live")}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${sectionLabelClass} transition-colors focus-ring ${
            activeTab === "live"
              ? "bg-muted text-foreground"
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
          role="tab"
          id="activity-tab-history"
          aria-selected={activeTab === "history"}
          aria-controls="activity-tabpanel-history"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${sectionLabelClass} transition-colors focus-ring ${
            activeTab === "history"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-3 w-3" />
          History
        </button>
      </div>

      {/* Content */}
      {activeTab === "live" ? (
        <div role="tabpanel" id="activity-tabpanel-live" aria-labelledby="activity-tab-live" className="flex-1 overflow-hidden">
          {timeline.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No live activity"
              description="Running cron jobs, heartbeats, and sub-agents appear here"
            />
          ) : (
            <LiveActivityFeed timeline={timeline} />
          )}
        </div>
      ) : (
        <div role="tabpanel" id="activity-tabpanel-history" aria-labelledby="activity-tab-history" className="flex-1 overflow-hidden">
          <HistoryFeed />
        </div>
      )}
    </div>
  );
});
