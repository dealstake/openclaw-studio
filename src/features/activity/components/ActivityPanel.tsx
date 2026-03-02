"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Activity, Radio, History, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterGroup, type FilterGroupOption } from "@/components/ui/FilterGroup";
import { useActivityMessageStore } from "@/features/activity/hooks/useActivityMessageStore";
import { useAnomalyAlerts } from "@/features/activity/hooks/useAnomalyAlerts";
import { LiveActivityFeed } from "./LiveActivityFeed";
import { HistoryFeed } from "./HistoryFeed";
import { AnomalyPanel } from "./AnomalyPanel";
import { SectionLabel } from "@/components/SectionLabel";

// ── Types ──────────────────────────────────────────────────────────────

type ActivityTab = "live" | "history" | "alerts";

// ── Main Panel ─────────────────────────────────────────────────────────

export const ActivityPanel = memo(function ActivityPanel() {
  const [activeTab, setActiveTab] = useState<ActivityTab>("live");
  const { messages: activityMessages } = useActivityMessageStore();
  const alertState = useAnomalyAlerts();

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
    { value: "alerts", label: "Alerts", icon: <AlertTriangle className="h-3 w-3" />, count: alertState.activeCount > 0 ? alertState.activeCount : undefined },
  ], [runningCount, alertState.activeCount]);

  // Single-select behavior: always exactly one tab selected
  const handleTabChange = useCallback((next: ActivityTab[]) => {
    if (next.length === 0) return;
    setActiveTab(next[next.length - 1]);
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <SectionLabel as="span">Activity</SectionLabel>
          {runningCount > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-sans text-xs font-semibold text-muted-foreground">
              {runningCount}
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-3 pb-1">
        <FilterGroup<ActivityTab>
          options={tabOptions}
          value={[activeTab]}
          onChange={handleTabChange}
          controlsId={`activity-tabpanel-${activeTab}`}
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
      ) : activeTab === "history" ? (
        <div role="tabpanel" id="activity-tabpanel-history" aria-labelledby="activity-tab-history" className="flex-1 overflow-hidden">
          <HistoryFeed />
        </div>
      ) : (
        <div role="tabpanel" id="activity-tabpanel-alerts" aria-labelledby="activity-tab-alerts" className="flex-1 overflow-hidden">
          <AnomalyPanel
            anomalies={alertState.anomalies}
            activeCount={alertState.activeCount}
            loading={alertState.loading}
            error={alertState.error}
            refresh={alertState.refresh}
            dismissOne={alertState.dismissOne}
            dismissAll={alertState.dismissAll}
          />
        </div>
      )}
    </div>
  );
});
