"use client";

import { memo, useState } from "react";
import { ChevronRight, Server, Copy, Check } from "lucide-react";
import type { CronJobSummary } from "@/lib/cron/types";
import { sectionLabelClass } from "@/components/SectionLabel";

interface RawGatewaySectionProps {
  cronJob?: CronJobSummary;
  cronJobId: string;
}

export const RawGatewaySection = memo(function RawGatewaySection({
  cronJob,
  cronJobId,
}: RawGatewaySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!cronJob) {
    return (
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Server className="h-3 w-3 shrink-0" />
          <span className={sectionLabelClass}>Gateway State</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          No gateway cron job found (ID: <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{cronJobId}</code>)
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    void navigator.clipboard.writeText(JSON.stringify(cronJob, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-b border-border/40 px-4 py-3">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 transition-transform duration-150 ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <Server className="h-3 w-3 shrink-0" />
        <span className={sectionLabelClass}>Gateway State</span>
        <code className="ml-auto rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
          {cronJobId}
        </code>
      </button>

      {expanded && (
        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Key fields summary */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>Session: <strong className="text-foreground">{cronJob.sessionTarget}</strong></span>
            <span>Wake: <strong className="text-foreground">{cronJob.wakeMode}</strong></span>
            <span>Payload: <strong className="text-foreground">{cronJob.payload.kind}</strong></span>
            {cronJob.delivery && (
              <span>Delivery: <strong className="text-foreground">{cronJob.delivery.mode}</strong></span>
            )}
          </div>

          {/* Schedule */}
          <div className="mt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Schedule</span>
            <pre className="mt-1 max-h-24 overflow-auto rounded-md border border-border/40 bg-muted/30 p-2 font-mono text-[10px] leading-relaxed text-foreground">
              {JSON.stringify(cronJob.schedule, null, 2)}
            </pre>
          </div>

          {/* Payload */}
          <div className="mt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payload</span>
            <pre className="mt-1 max-h-32 overflow-auto rounded-md border border-border/40 bg-muted/30 p-2 font-mono text-[10px] leading-relaxed text-foreground">
              {JSON.stringify(cronJob.payload, null, 2)}
            </pre>
          </div>

          {/* State */}
          <div className="mt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Runtime State</span>
            <pre className="mt-1 max-h-24 overflow-auto rounded-md border border-border/40 bg-muted/30 p-2 font-mono text-[10px] leading-relaxed text-foreground">
              {JSON.stringify(cronJob.state, null, 2)}
            </pre>
          </div>

          {/* Delivery */}
          {cronJob.delivery && (
            <div className="mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Delivery</span>
              <pre className="mt-1 max-h-16 overflow-auto rounded-md border border-border/40 bg-muted/30 p-2 font-mono text-[10px] leading-relaxed text-foreground">
                {JSON.stringify(cronJob.delivery, null, 2)}
              </pre>
            </div>
          )}

          {/* Copy full JSON */}
          <button
            type="button"
            className="mt-2 flex items-center gap-1 rounded-md border border-border/60 bg-card/50 px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy full JSON
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
});
