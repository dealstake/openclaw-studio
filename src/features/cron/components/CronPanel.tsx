"use client";

import { memo, useMemo, useState } from "react";
import { Clock, Plus, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { CronJobSummary } from "@/lib/cron/types";
import { PanelIconButton } from "@/components/PanelIconButton";
import { SectionLabel } from "@/components/SectionLabel";
import { PanelToolbar } from "@/components/ui/PanelToolbar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CronJobListItem } from "./CronJobListItem";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type CronPanelProps = {
  client: GatewayClient;
  cronJobs: CronJobSummary[];
  loading: boolean;
  error: string | null;
  runBusyJobId: string | null;
  deleteBusyJobId: string | null;
  toggleBusyJobId?: string | null;
  onRunJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onToggleEnabled?: (jobId: string) => void;
  onRefresh: () => void;
};

export const CronPanel = memo(function CronPanel({
  client,
  cronJobs,
  loading,
  error,
  runBusyJobId,
  deleteBusyJobId,
  toggleBusyJobId,
  onRunJob,
  onDeleteJob,
  onToggleEnabled,
  onRefresh,
}: CronPanelProps) {
  const [deleteConfirmJob, setDeleteConfirmJob] =
    useState<CronJobSummary | null>(null);

  // Filter out [TASK]-prefixed jobs — managed exclusively via Tasks panel
  const filteredJobs = useMemo(
    () => cronJobs.filter((j) => !j.name.startsWith("[TASK]")),
    [cronJobs],
  );
  const taskJobCount = cronJobs.length - filteredJobs.length;

  const enabledCount = useMemo(
    () => filteredJobs.filter((j) => j.enabled).length,
    [filteredJobs],
  );
  const errorCount = useMemo(
    () => filteredJobs.filter((j) => j.state.lastStatus === "error").length,
    [filteredJobs],
  );

  return (
    <TooltipProvider>
      <div className="flex h-full w-full flex-col overflow-hidden">
        <PanelToolbar
          actions={
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <PanelIconButton
                      aria-label="New cron job (use CLI)"
                      disabled
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </PanelIconButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Create jobs via CLI</p>
                </TooltipContent>
              </Tooltip>
              <PanelIconButton
                aria-label="Refresh cron jobs"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </PanelIconButton>
            </>
          }
        >
          <SectionLabel>Cron jobs</SectionLabel>
        </PanelToolbar>

        {(filteredJobs.length > 0 || taskJobCount > 0) ? (
          <div className="flex items-center gap-3 border-b border-border/30 px-4 py-1.5 text-[10px] text-muted-foreground">
            <span>
              {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}
            </span>
            <span className="text-border">·</span>
            <span>{enabledCount} enabled</span>
            {errorCount > 0 ? (
              <>
                <span className="text-border">·</span>
                <span className="text-destructive">{errorCount} errored</span>
              </>
            ) : null}
            {taskJobCount > 0 ? (
              <>
                <span className="text-border">·</span>
                <span>{taskJobCount} in Tasks</span>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error ? (
            <ErrorBanner
              className="mb-3"
              message={error}
              onRetry={onRefresh}
            />
          ) : null}

          {loading && filteredJobs.length === 0 ? (
            <CardSkeleton count={3} variant="card" />
          ) : null}

          {!loading && !error && filteredJobs.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No cron jobs"
              description={taskJobCount > 0
                ? `${taskJobCount} task job${taskJobCount !== 1 ? "s" : ""} managed in the Tasks panel`
                : "Create jobs via the CLI to schedule recurring tasks for your agent"}
            />
          ) : null}

          {filteredJobs.length > 0 ? (
            <div className="flex flex-col gap-2 animate-in fade-in duration-300">
              {filteredJobs.map((job, idx) => (
                <CronJobListItem
                  key={job.id}
                  job={job}
                  client={client}
                  runBusy={runBusyJobId === job.id}
                  deleteBusy={deleteBusyJobId === job.id}
                  toggleBusy={toggleBusyJobId === job.id}
                  onRunJob={onRunJob}
                  onDeleteConfirm={setDeleteConfirmJob}
                  onToggleEnabled={onToggleEnabled}
                  animationDelay={Math.min(idx * 50, 300)}
                />
              ))}
            </div>
          ) : null}
        </div>

        <ConfirmDialog
          open={!!deleteConfirmJob}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmJob(null);
          }}
          title="Delete cron job"
          description={
            deleteConfirmJob
              ? `Are you sure you want to delete "${deleteConfirmJob.name}"? This action cannot be undone.`
              : ""
          }
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            if (deleteConfirmJob) {
              onDeleteJob(deleteConfirmJob.id);
              setDeleteConfirmJob(null);
            }
          }}
        />
      </div>
    </TooltipProvider>
  );
});
