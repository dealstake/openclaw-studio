"use client";

import { memo } from "react";
import { Activity } from "lucide-react";

/**
 * ActivityPanel — Context panel tab for real-time activity feed.
 * Renders heartbeat, cron completion, sub-agent, and system events
 * as a chat-like stream using AI Elements rendering.
 *
 * Phase 1: Shell component with placeholder UI.
 * Phase 4 will add full AI Elements rendering.
 */
export const ActivityPanel = memo(function ActivityPanel() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
      <Activity className="h-8 w-8 opacity-30" />
      <p className="text-sm font-medium">Activity</p>
      <p className="text-xs text-muted-foreground/70">
        Live events from heartbeats, cron jobs, and sub-agents will appear here.
      </p>
    </div>
  );
});
