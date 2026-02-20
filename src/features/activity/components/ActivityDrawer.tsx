"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { PanelSize } from "react-resizable-panels";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import { CompactActivityCard } from "./CompactActivityCard";
import type { ActivityStatus } from "./CompactActivityCard";

const DRAWER_STATE_KEY = "studio:activity-drawer-state";

interface DrawerState {
  collapsed: boolean;
  size: number;
}

function loadDrawerState(): DrawerState {
  if (typeof window === "undefined") return { collapsed: true, size: 28 };
  try {
    const raw = localStorage.getItem(DRAWER_STATE_KEY);
    if (raw) return JSON.parse(raw) as DrawerState;
  } catch { /* ignore */ }
  return { collapsed: true, size: 28 };
}

function saveDrawerState(s: DrawerState) {
  try { localStorage.setItem(DRAWER_STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export interface ActivityEntry {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  status: ActivityStatus;
  elapsed?: string;
  badge?: string;
  timestamp: number;
}

export interface ActivityDrawerProps {
  children: React.ReactNode;
  entries?: ActivityEntry[];
  eventCount?: number;
  hasRunning?: boolean;
  hidden?: boolean;
}

const CollapsedIndicator = React.memo(function CollapsedIndicator({
  eventCount,
  hasRunning,
  onExpand,
}: {
  eventCount: number;
  hasRunning: boolean;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Open activity drawer"
      className="flex h-full w-8 flex-col items-center justify-center gap-2 border-l border-border bg-card/30 transition-colors hover:bg-card/60"
    >
      <Activity className="h-4 w-4 text-muted-foreground" />
      {hasRunning && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      )}
      {eventCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {eventCount > 99 ? "99+" : eventCount}
        </span>
      )}
      <ChevronLeft className="h-3 w-3 text-muted-foreground/50" />
    </button>
  );
});

const DrawerContent = React.memo(function DrawerContent({
  entries,
  onCollapse,
}: {
  entries: ActivityEntry[];
  onCollapse: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <SectionLabel>Activity</SectionLabel>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Close activity drawer"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
            <Activity className="h-8 w-8 opacity-30" />
            <p className="text-xs">No recent activity</p>
          </div>
        ) : (
          entries.map((entry) => (
            <CompactActivityCard
              key={entry.id}
              icon={entry.icon}
              title={entry.title}
              subtitle={entry.subtitle}
              status={entry.status}
              elapsed={entry.elapsed}
              badge={entry.badge}
            />
          ))
        )}
      </div>
    </div>
  );
});

export const ActivityDrawer = React.memo(function ActivityDrawer({
  children,
  entries = [],
  eventCount = 0,
  hasRunning = false,
  hidden = false,
}: ActivityDrawerProps) {
  const [drawerState, setDrawerState] = useState<DrawerState>(loadDrawerState);

  useEffect(() => {
    saveDrawerState(drawerState);
  }, [drawerState]);

  const handleCollapse = useCallback(() => {
    setDrawerState((prev) => ({ ...prev, collapsed: true }));
  }, []);

  const handleExpand = useCallback(() => {
    setDrawerState((prev) => ({ ...prev, collapsed: false }));
  }, []);

  const handleToggle = useCallback(() => {
    setDrawerState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  const handlePanelResize = useCallback((panelSize: PanelSize) => {
    if (panelSize.asPercentage > 1) {
      setDrawerState((prev) => ({ ...prev, size: panelSize.asPercentage, collapsed: false }));
    } else {
      setDrawerState((prev) => ({ ...prev, collapsed: true }));
    }
  }, []);

  if (hidden) {
    return <>{children}</>;
  }

  return (
    <Group orientation="horizontal" className="h-full">
      <Panel id="chat-main" minSize="40%">
        {children}
      </Panel>
      <Separator className="group relative flex w-2 items-center justify-center hover:bg-border/30 transition-colors">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={drawerState.collapsed ? "Open activity drawer" : "Close activity drawer"}
          className="absolute z-10 flex h-6 w-4 items-center justify-center rounded-sm bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {drawerState.collapsed ? (
            <ChevronLeft className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <div className="h-8 w-px bg-border group-hover:bg-foreground/20 transition-colors" />
      </Separator>
      <Panel
        id="activity-drawer"
        defaultSize={drawerState.collapsed ? "0%" : `${drawerState.size}%`}
        minSize="0%"
        collapsible
        collapsedSize="0%"
        onResize={handlePanelResize}
      >
        {drawerState.collapsed ? (
          <CollapsedIndicator
            eventCount={eventCount}
            hasRunning={hasRunning}
            onExpand={handleExpand}
          />
        ) : (
          <DrawerContent entries={entries} onCollapse={handleCollapse} />
        )}
      </Panel>
    </Group>
  );
});
