"use client";

import { memo, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCronPayload, formatCronSchedule } from "@/lib/cron/types";
import { formatRelativeTime } from "@/lib/text/time";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useCronJobsPanel } from "../hooks/useCronJobsPanel";
import { SettingsListSection } from "./SettingsListSection";
import { SettingsListItem } from "./SettingsListItem";

type CronJobsSettingsSectionProps = {
  client: GatewayClient;
  agentId: string;
  status: GatewayStatus;
  onNavigateToTasks?: () => void;
};

export const CronJobsSettingsSection = memo(function CronJobsSettingsSection({
  client,
  agentId,
  status,
  onNavigateToTasks,
}: CronJobsSettingsSectionProps) {
  const {
    cronJobs,
    cronLoading,
    cronError,
    cronRunBusyJobId,
    cronDeleteBusyJobId,
    cronToggleBusyJobId,
    loadCronJobs,
    handleRunCronJob,
    handleDeleteCronJob,
    handleToggleCronJob,
    resetCron,
  } = useCronJobsPanel({ client });

  useEffect(() => {
    if (status !== "connected" || !agentId) {
      resetCron();
      return;
    }
    void loadCronJobs(agentId);
  }, [agentId, status, loadCronJobs, resetCron]);

  return (
    <SettingsListSection
      label="Cron status"
      testId="agent-settings-cron"
      count={cronJobs.length}
      loading={cronLoading}
      error={cronError}
      onRetry={() => { void loadCronJobs(agentId); }}
      emptyMessage="No cron jobs for this agent."
      isEmpty={cronJobs.length === 0}
      footer={onNavigateToTasks ? (
        <button
          type="button"
          className="mt-1 text-[11px] text-muted-foreground transition hover:text-foreground focus-ring rounded"
          onClick={onNavigateToTasks}
        >
          View in Tasks →
        </button>
      ) : undefined}
    >
      {cronJobs.map((job) => (
        <SettingsListItem
          key={job.id}
          id={job.id}
          title={job.name}
          titleTooltip={job.name}
          groupName="cron"
          enabled={job.enabled}
          toggleEnabled
          toggleBusy={cronToggleBusyJobId === job.id}
          onToggle={(enabled) => { void handleToggleCronJob(agentId, job.id, enabled); }}
          statusLine={
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              {job.state.lastStatus ? (
                <span className="inline-flex items-center gap-1">
                  <span className={job.state.lastStatus === "ok" ? "text-emerald-500" : job.state.lastStatus === "error" ? "text-destructive" : "text-muted-foreground"}>
                    {job.state.lastStatus === "ok" ? "✓" : job.state.lastStatus === "error" ? "✗" : "⏭"}
                  </span>
                  {job.state.lastRunAtMs ? formatRelativeTime(job.state.lastRunAtMs) : "—"}
                </span>
              ) : (
                <span>Never run</span>
              )}
              {job.state.runningAtMs ? (
                <span className="text-amber-500">⏳ Running</span>
              ) : null}
            </div>
          }
          metadata={
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {formatCronSchedule(job.schedule)}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">{formatCronSchedule(job.schedule)}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {formatCronPayload(job.payload)}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  {formatCronPayload(job.payload)}
                </TooltipContent>
              </Tooltip>
            </>
          }
          runBusy={cronRunBusyJobId === job.id}
          deleteBusy={cronDeleteBusyJobId === job.id}
          runLabel={`Run cron job ${job.name} now`}
          deleteLabel={`Delete cron job ${job.name}`}
          onRun={() => { void handleRunCronJob(agentId, job.id); }}
          onDelete={() => { void handleDeleteCronJob(agentId, job.id); }}
        />
      ))}
    </SettingsListSection>
  );
});
