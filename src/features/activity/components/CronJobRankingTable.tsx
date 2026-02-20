"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { type CronRunEntry, fetchCronRuns } from "@/lib/cron/types";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { formatDuration, formatRelativeTime } from "@/lib/text/time";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { JobStats } from "../lib/cronStatsCalculator";
import { TrendSparkline } from "./TrendSparkline";

const compactNumber = new Intl.NumberFormat("en", { notation: "compact" });

function successRateColor(rate: number): string {
  if (rate >= 0.9) return "text-green-400";
  if (rate >= 0.7) return "text-yellow-400";
  return "text-red-400";
}

function runStatusDot(status: string): string {
  if (status === "ok") return "bg-green-500";
  if (status === "error") return "bg-red-500";
  return "bg-muted-foreground";
}

const JobRow = memo(function JobRow({
  job,
  maxTokens,
  client,
}: {
  job: JobStats;
  maxTokens: number;
  client: GatewayClient;
}) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<CronRunEntry[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const fetchedRef = useRef(false);

  const loadRuns = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoadingRuns(true);
    try {
      const result = await fetchCronRuns(client, job.jobId, 10);
      setRuns(result);
    } catch {
      // silently fail — row just stays empty
    } finally {
      setLoadingRuns(false);
    }
  }, [client, job.jobId]);

  useEffect(() => {
    if (open && !fetchedRef.current) {
      loadRuns();
    }
  }, [open, loadRuns]);

  const tokenPct = maxTokens > 0 ? (job.totalTokens / maxTokens) * 100 : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-left transition hover:bg-muted/30"
        >
          <ChevronRight
            className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span className="flex-1 truncate text-xs font-medium text-foreground min-w-[100px]">
            {job.jobName}
          </span>
          <span className="text-[10px] text-muted-foreground">{job.totalRuns} runs</span>
          <span className="text-[10px] text-muted-foreground w-10 text-right">
            {compactNumber.format(job.totalTokens)}
          </span>
          <span className={`text-[10px] font-medium w-8 text-right ${successRateColor(job.successRate)}`}>
            {Math.round(job.successRate * 100)}%
          </span>
          <TrendSparkline
            data={job.durationTrend}
            width={48}
            height={16}
            color="var(--color-muted-foreground)"
          />
        </button>
      </CollapsibleTrigger>

      {/* Token proportion bar */}
      <div className="mx-3 mt-1 h-1 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/60 transition-all"
          style={{ width: `${tokenPct}%` }}
        />
      </div>

      <CollapsibleContent>
        <div className="mt-1 space-y-1 px-3 pb-2">
          {loadingRuns && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loadingRuns && runs.length === 0 && (
            <p className="text-[10px] text-muted-foreground py-1">No run history.</p>
          )}
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex items-center gap-2 rounded-md bg-muted/20 px-2 py-1"
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${runStatusDot(run.status)}`} />
              <span className="text-[10px] text-muted-foreground w-14 shrink-0">
                {run.startedAtMs ? formatRelativeTime(run.startedAtMs) : "—"}
              </span>
              <span className="text-[10px] text-foreground">
                {formatDuration(run.durationMs ?? 0)}
              </span>
              {run.error && (
                <span className="truncate text-[10px] text-red-400">{run.error}</span>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

export const CronJobRankingTable = memo(function CronJobRankingTable({
  jobStats,
  loading,
  client,
}: {
  jobStats: JobStats[];
  loading: boolean;
  client: GatewayClient;
}) {
  const maxTokens = Math.max(...jobStats.map((j) => j.totalTokens), 1);

  if (loading && jobStats.length === 0) {
    return (
      <div className="space-y-2 p-3">
        <SectionLabel>Jobs</SectionLabel>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  if (jobStats.length === 0) {
    return (
      <div className="p-3">
        <SectionLabel>Jobs</SectionLabel>
        <p className="py-4 text-center text-xs text-muted-foreground">
          No cron job data yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      <SectionLabel>Jobs</SectionLabel>
      <div className="space-y-2">
        {jobStats.map((job) => (
          <JobRow key={job.jobId} job={job} maxTokens={maxTokens} client={client} />
        ))}
      </div>
    </div>
  );
});
