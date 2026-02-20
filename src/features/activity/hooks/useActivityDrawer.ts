"use client";

import { useCallback, useMemo, useState } from "react";
import { useLiveActivityStore } from "./useLiveActivityStore";
import type { LiveActivityEntry, SystemActivityEvent } from "./useLiveActivityStore";

export type DrawerTab = "live" | "history";

export interface ActivityDrawerState {
  /** Active tab */
  tab: DrawerTab;
  /** Fullscreen expand state: which tab is expanded, or null */
  expandedTab: DrawerTab | null;
  /** Count of running sessions (for badge) */
  runningCount: number;
  /** Total event count (live sessions + system events, for collapsed indicator) */
  eventCount: number;
  /** Whether any session is currently running */
  hasRunning: boolean;
  /** Sorted live sessions */
  liveSessions: LiveActivityEntry[];
  /** Recent system events */
  systemEvents: SystemActivityEvent[];
}

export interface ActivityDrawerActions {
  setTab: (tab: DrawerTab) => void;
  expandTab: (tab: DrawerTab) => void;
  closeExpand: () => void;
}

/**
 * Orchestrator hook for the ActivityDrawer.
 * Combines live store data with UI state management.
 */
export function useActivityDrawer(): ActivityDrawerState & ActivityDrawerActions {
  const { sessions, systemEvents } = useLiveActivityStore();
  const [tab, setTab] = useState<DrawerTab>("live");
  const [expandedTab, setExpandedTab] = useState<DrawerTab | null>(null);

  const liveSessions = useMemo(() => {
    return [...sessions.values()].sort((a, b) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (a.status !== "running" && b.status === "running") return 1;
      return b.startedAt - a.startedAt;
    });
  }, [sessions]);

  const runningCount = useMemo(
    () => liveSessions.filter((s) => s.status === "running").length,
    [liveSessions]
  );

  const recentSystemEvents = useMemo(
    () => systemEvents.slice(-10).reverse(),
    [systemEvents]
  );

  const eventCount = liveSessions.length + recentSystemEvents.length;
  const hasRunning = runningCount > 0;

  const expandTab = useCallback((t: DrawerTab) => setExpandedTab(t), []);
  const closeExpand = useCallback(() => setExpandedTab(null), []);

  return {
    tab,
    expandedTab,
    runningCount,
    eventCount,
    hasRunning,
    liveSessions,
    systemEvents: recentSystemEvents,
    setTab,
    expandTab,
    closeExpand,
  };
}
