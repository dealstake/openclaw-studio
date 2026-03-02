"use client";

import { memo } from "react";
import { Clock, Coins, Zap } from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { Skeleton } from "@/components/Skeleton";
import { sectionLabelClass } from "@/components/SectionLabel";
import { formatCostUsd } from "../lib/costEstimator";
import type { PlaygroundResult } from "../lib/types";

interface ResponseViewProps {
  /** Latest result — null when nothing has run yet */
  result: PlaygroundResult | null;
  /** Text currently streaming in (takes precedence over result.response.text) */
  streamText: string | null;
  isStreaming: boolean;
  error: string | null;
}

export const ResponseView = memo(function ResponseView({
  result,
  streamText,
  isStreaming,
  error,
}: ResponseViewProps) {
  // Nothing to show yet
  if (!result && !isStreaming && !error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-6 py-10">
        <Zap className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">
          Configure your prompt above and hit{" "}
          <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">⌘↵</kbd>{" "}
          to run
        </p>
      </div>
    );
  }

  const displayText = isStreaming && streamText !== null
    ? streamText
    : result?.response?.text ?? null;

  const response = result?.response;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Response text */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3">
        {isStreaming && !displayText ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
        ) : displayText ? (
          <div className="prose-wrapper">
            <MarkdownViewer content={displayText} />
            {isStreaming && (
              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-full bg-primary align-middle" />
            )}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        ) : null}
      </div>

      {/* Metrics footer */}
      {response && !isStreaming && (
        <div className="flex flex-shrink-0 items-center gap-4 border-t border-border/50 px-3 py-2">
          {response.latencyMs !== undefined && (
            <MetricBadge
              icon={<Clock className="h-3 w-3" />}
              label={`${(response.latencyMs / 1000).toFixed(1)}s`}
              title="Response latency"
            />
          )}
          {response.tokensIn !== undefined && response.tokensOut !== undefined && (
            <MetricBadge
              icon={<Zap className="h-3 w-3" />}
              label={`${response.tokensIn.toLocaleString()} in · ${response.tokensOut.toLocaleString()} out`}
              title="Token usage (estimated)"
            />
          )}
          {response.estimatedCostUsd !== undefined && (
            <MetricBadge
              icon={<Coins className="h-3 w-3" />}
              label={formatCostUsd(response.estimatedCostUsd)}
              title="Estimated cost (USD)"
            />
          )}
        </div>
      )}
      {/* Streaming footer */}
      {isStreaming && (
        <div className="flex flex-shrink-0 items-center gap-2 border-t border-border/50 px-3 py-2">
          <span className={`${sectionLabelClass} text-muted-foreground animate-pulse`}>
            Generating…
          </span>
        </div>
      )}
    </div>
  );
});

// ── Micro component ──────────────────────────────────────────────────────────

interface MetricBadgeProps {
  icon: React.ReactNode;
  label: string;
  title?: string;
}

function MetricBadge({ icon, label, title }: MetricBadgeProps) {
  return (
    <div
      className="flex items-center gap-1 text-muted-foreground"
      title={title}
    >
      {icon}
      <span className={sectionLabelClass}>{label}</span>
    </div>
  );
}
