"use client";

import React, { useMemo } from "react";
import { Activity } from "lucide-react";
import { useLiveActivityStore } from "@/features/activity/hooks/useLiveActivityStore";
import { useHeartbeatEntries } from "@/features/activity/hooks/useHeartbeatEntries";
import { CompactActivityCard } from "./CompactActivityCard";
import type { ActivityStatus } from "./CompactActivityCard";
import type { LiveActivityEntry, SystemActivityEvent } from "@/features/activity/hooks/useLiveActivityStore";

/** Map cron task names to emoji icons. */
function taskEmoji(taskName: string): string {
  const lower = taskName.toLowerCase();
  if (lower.includes("continuation")) return "⚡";
  if (lower.includes("auditor") || lower.includes("audit")) return "🔍";
  if (lower.includes("research")) return "🔬";
  if (lower.includes("visual qa") || lower.includes("visual-qa")) return "👁";
  if (lower.includes("health") || lower.includes("gateway")) return "🏥";
  return "🤖";
}

function formatElapsed(startedAt: number): string {
  const ms = Date.now() - startedAt;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

const SYSTEM_ICONS: Record<string, string> = {
  "exec-approval": "🔐",
  "session-lifecycle": "📋",
  "cron-schedule": "⏰",
};

export interface LiveActivityFeedProps {
  className?: string;
}

export const LiveActivityFeed = React.memo(function LiveActivityFeed({
  className,
}: LiveActivityFeedProps) {
  const { sessions, systemEvents } = useLiveActivityStore();
  const heartbeatEntries = useHeartbeatEntries();

  const sorted = useMemo(() => {
    return [...sessions.values()].sort((a: LiveActivityEntry, b: LiveActivityEntry) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (a.status !== "running" && b.status === "running") return 1;
      return b.startedAt - a.startedAt;
    });
  }, [sessions]);

  const recentSystemEvents = useMemo(() => {
    return systemEvents.slice(-10).reverse();
  }, [systemEvents]);

  const recentHeartbeats = useMemo(() => heartbeatEntries.slice(0, 5), [heartbeatEntries]);

  if (sorted.length === 0 && recentSystemEvents.length === 0 && recentHeartbeats.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground ${className ?? ""}`}>
        <Activity className="h-8 w-8 opacity-30" />
        <p className="text-xs">No live activity</p>
        <p className="text-xs text-muted-foreground/60">
          Running cron jobs and sub-agents appear here
        </p>
      </div>
    );
  }

  return (
    <div className={`overflow-y-auto p-2 space-y-1.5 ${className ?? ""}`}>
      {sorted.map((entry: LiveActivityEntry) => (
        <CompactActivityCard
          key={entry.sessionKey}
          icon={taskEmoji(entry.taskName)}
          title={entry.taskName || "Agent Run"}
          subtitle={entry.lastAction || entry.lastTextSnippet?.slice(0, 60) || ""}
          status={entry.status as ActivityStatus}
          elapsed={entry.status === "running" ? formatElapsed(entry.startedAt) : undefined}
          badge={entry.streaming ? "LIVE" : undefined}
        />
      ))}
      {recentHeartbeats.map((hb) => (
        <CompactActivityCard
          key={`hb-${hb.runId}`}
          icon="💓"
          title="Heartbeat"
          subtitle={hb.status === "ok" ? "All clear" : hb.text.slice(0, 80)}
          status={hb.status === "ok" ? "completed" : "error"}
          elapsed={formatElapsed(hb.timestamp)}
        />
      ))}
      {recentSystemEvents.map((evt: SystemActivityEvent) => (
        <CompactActivityCard
          key={evt.id}
          icon={SYSTEM_ICONS[evt.kind] ?? "📋"}
          title={evt.title}
          subtitle={evt.subtitle}
          status="completed"
        />
      ))}
    </div>
  );
});
