"use client";

import { memo } from "react";
import { Clock, Coins, GitCompare, Zap } from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { Skeleton } from "@/components/Skeleton";
import { sectionLabelClass } from "@/components/SectionLabel";
import { formatCostUsd } from "../lib/costEstimator";
import type { CompareColumnResult, CompareRun } from "../lib/types";

interface ComparisonViewProps {
  run: CompareRun | null;
  isAnyStreaming: boolean;
}

export const ComparisonView = memo(function ComparisonView({
  run,
  isAnyStreaming,
}: ComparisonViewProps) {
  if (!run && !isAnyStreaming) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-6 py-10">
        <GitCompare className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground/60">
          Select 2–3 models above and hit{" "}
          <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">
            ⌘↵
          </kbd>{" "}
          to compare responses side-by-side
        </p>
      </div>
    );
  }

  const columns = run?.columns ?? [];

  return (
    <div className="flex h-full min-w-0 flex-row divide-x divide-border overflow-x-auto">
      {columns.map((col, idx) => (
        <CompareColumn
          key={`${col.model}-${idx}`}
          column={col}
          colCount={columns.length}
        />
      ))}
    </div>
  );
});

// ── Per-model column ─────────────────────────────────────────────────────────

interface CompareColumnProps {
  column: CompareColumnResult;
  colCount: number;
}

const CompareColumn = memo(function CompareColumn({
  column,
  colCount,
}: CompareColumnProps) {
  const { model, response, streamText, isStreaming, error } = column;
  const modelLabel = humanizeModelKey(model);
  const minWidth = colCount === 2 ? "min-w-[280px]" : "min-w-[260px]";
  const displayText =
    isStreaming && streamText !== null ? streamText : response?.text ?? null;

  return (
    <div className={`flex flex-1 flex-col overflow-hidden ${minWidth}`}>
      {/* Column header */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
        <ModelBadge model={model} />
        <span className="truncate text-xs font-medium text-foreground">
          {modelLabel}
        </span>
        {isStreaming && (
          <span
            className={`ml-auto ${sectionLabelClass} animate-pulse text-muted-foreground/60`}
          >
            Generating…
          </span>
        )}
      </div>

      {/* Response body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-2">
        {isStreaming && !displayText ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
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
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-t border-border/50 px-3 py-2">
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
              label={`${response.tokensIn.toLocaleString()}↑ ${response.tokensOut.toLocaleString()}↓`}
              title="Tokens in / out"
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
    </div>
  );
});

// ── Micro components ─────────────────────────────────────────────────────────

function ModelBadge({ model }: { model: string }) {
  const provider = model.split("/")[0]?.toLowerCase() ?? "";
  const colorMap: Record<string, string> = {
    anthropic: "bg-[#d97706]/15 text-[#d97706]",
    google: "bg-[#4285f4]/15 text-[#4285f4]",
    openai: "bg-[#10a37f]/15 text-[#10a37f]",
    meta: "bg-purple-500/15 text-purple-500",
    mistral: "bg-orange-500/15 text-orange-500",
  };
  const colorClass = colorMap[provider] ?? "bg-muted text-muted-foreground";
  const letter = provider.charAt(0).toUpperCase();

  return (
    <span
      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold ${colorClass}`}
      title={provider}
    >
      {letter}
    </span>
  );
}

interface MetricBadgeProps {
  icon: React.ReactNode;
  label: string;
  title?: string;
}

function MetricBadge({ icon, label, title }: MetricBadgeProps) {
  return (
    <div className="flex items-center gap-1 text-muted-foreground" title={title}>
      {icon}
      <span className={sectionLabelClass}>{label}</span>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function humanizeModelKey(key: string): string {
  const [, ...idParts] = key.split("/");
  const id = idParts.join("/");
  const versionRe = /^(\d+)-(\d+)$/;
  return id
    .split("-")
    .reduce<string[]>((acc, segment, i, arr) => {
      if (i > 0) {
        const combined = `${arr[i - 1]}-${segment}`;
        if (versionRe.test(combined)) {
          acc[acc.length - 1] = combined.replace(versionRe, "$1.$2");
          return acc;
        }
      }
      if (i < arr.length - 1) {
        const next = `${segment}-${arr[i + 1]}`;
        if (versionRe.test(next)) {
          acc.push(segment);
          return acc;
        }
      }
      acc.push(segment.charAt(0).toUpperCase() + segment.slice(1));
      return acc;
    }, [])
    .join(" ");
}
