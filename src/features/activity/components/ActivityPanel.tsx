"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Activity, Radio, History } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterGroup, type FilterGroupOption } from "@/components/ui/FilterGroup";
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

  const tabOptions = useMemo<FilterGroupOption<ActivityTab>[]>(() => [
    { value: "live", label: "Live", icon: <Radio className="h-3 w-3" />, count: runningCount > 0 ? runningCount : undefined },
    { value: "history", label: "History", icon: <History className="h-3 w-3" /> },
  ], [runningCount]);

  // Single-select behavior: always exactly one tab selected
  const handleTabChange = useCallback((next: ActivityTab[]) => {
    if (next.length === 0) return; // Don't allow deselecting
    // Take the newest selection (last added)
    setActiveTab(next[next.length - 1]);
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="px-3 pt-2 pb-1">
        <FilterGroup<ActivityTab>
          options={tabOptions}
          value={[activeTab]}
          onChange={handleTabChange}
        />
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
