"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { SectionLabel } from "@/components/SectionLabel";
import { PanelIconButton } from "@/components/PanelIconButton";
import { sectionLabelClass } from "@/components/SectionLabel";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { useCronAnalytics } from "../hooks/useCronAnalytics";
import { useAllCronJobs } from "@/features/cron/hooks/useAllCronJobs";
import { formatActivityEvent } from "../lib/activityFormatter";
import { ActivityFilterBar } from "./ActivityFilterBar";
import { ActivityFeed } from "./ActivityFeed";
import { CronAnalyticsSummary } from "./CronAnalyticsSummary";
import { CronJobRankingTable } from "./CronJobRankingTable";

type ViewMode = "feed" | "analytics";

export const ActivityPanel = memo(function ActivityPanel({
  client,
  status,
  agentId,
}: {
  client: GatewayClient;
  status: GatewayStatus;
  agentId: string | null;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Cron jobs + analytics
  const { allCronJobs, loadAllCronJobs } = useAllCronJobs(client, status);
  const { jobStats, loading: analyticsLoading, refresh: refreshAnalytics } =
    useCronAnalytics(client, status, allCronJobs);

  // For task-name filtering, we filter client-side after fetching all events
  const { events: rawEvents, loading, error, refresh, loadMore, hasMore } =
    useActivityFeed(agentId, activeFilter === "__errors__" ? { status: "error" } : undefined);

  // Client-side filter by taskName (API doesn't filter by taskName directly)
  const filteredRaw = useMemo(() => {
    if (!activeFilter || activeFilter === "__errors__") return rawEvents;
    return rawEvents.filter((e) => e.taskName === activeFilter);
  }, [rawEvents, activeFilter]);

  // Format for display
  const displayEvents = useMemo(
    () => filteredRaw.map(formatActivityEvent),
    [filteredRaw]
  );

  // Compute filter counts from all raw events
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { __total: rawEvents.length };
    for (const e of rawEvents) {
      counts[e.taskName] = (counts[e.taskName] ?? 0) + 1;
      if (e.status === "error") {
        counts.__errors__ = (counts.__errors__ ?? 0) + 1;
      }
    }
    return counts;
  }, [rawEvents]);

  // Initial load
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (agentId && !initialLoadDone.current) {
      initialLoadDone.current = true;
      refresh();
      loadAllCronJobs();
    }
  }, [agentId, refresh, loadAllCronJobs]);

  // Live refresh on cron events (debounced 2s)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== "connected") return;
    const unsub = client.onEvent((event: { event?: string }) => {
      if (event.event === "cron") {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          refresh();
          refreshAnalytics();
        }, 2000);
      }
    });
    return () => {
      unsub();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [client, status, refresh, refreshAnalytics]);

  const handleRefresh = useCallback(() => {
    refresh();
    if (viewMode === "analytics") refreshAnalytics();
  }, [refresh, refreshAnalytics, viewMode]);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <SectionLabel className="flex-1">Activity</SectionLabel>
        <div className="flex gap-0.5">
          {(["feed", "analytics"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`${sectionLabelClass} rounded-md px-1.5 py-0.5 transition ${
                viewMode === mode
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                setViewMode(mode);
                if (mode === "analytics") refreshAnalytics();
              }}
            >
              {mode === "feed" ? "Feed" : "Analytics"}
            </button>
          ))}
        </div>
        <PanelIconButton onClick={handleRefresh} aria-label="Refresh activity">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </PanelIconButton>
      </div>

      {/* Content */}
      {viewMode === "feed" ? (
        <div className="flex flex-1 flex-col min-h-0">
          <ActivityFilterBar
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={filterCounts}
          />
          <ActivityFeed
            events={displayEvents}
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            onLoadMore={loadMore}
            hasMore={hasMore}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <CronAnalyticsSummary jobStats={jobStats} loading={analyticsLoading} />
          <CronJobRankingTable jobStats={jobStats} loading={analyticsLoading} client={client} />
        </div>
      )}
    </div>
  );
});
