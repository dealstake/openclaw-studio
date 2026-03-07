"use client";

import { memo, useState } from "react";
import { RefreshCw, ChevronDown, ChevronRight, FileText, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { IconButton } from "@/components/IconButton";
import { sectionLabelClass } from "@/components/SectionLabel";
import { formatTokenEstimate } from "@/lib/text/tokens";
import { formatSize } from "@/lib/text/format";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { useContextBudget } from "../hooks/useContextBudget";
import { DonutChart, type DonutSegment } from "./DonutChart";
import { ContextProfileEditor } from "./ContextProfileEditor";
import { BUDGET_CATEGORY_ORDER, CATEGORY_META, type BudgetCategory } from "../types";

interface ContextBudgetCardProps {
  /** The agent whose workspace files are being analyzed */
  agentId: string | null | undefined;
  /**
   * Active gateway client — when provided, enables Phase 2 per-file
   * context mode controls via the ContextProfileEditor.
   */
  client?: GatewayClient;
  /** Current gateway connection status — required when `client` is provided. */
  status?: GatewayStatus;
}

/** Expandable category row in the file breakdown */
const CategoryRow = memo(function CategoryRow({
  category,
  tokens,
  totalTokens,
  fileCount,
  color,
  label,
  description,
  files,
}: {
  category: BudgetCategory;
  tokens: number;
  totalTokens: number;
  fileCount: number;
  color: string;
  label: string;
  description: string;
  files: Array<{ name: string; path: string; bytes: number; tokens: number }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = totalTokens > 0 ? Math.round((tokens / totalTokens) * 100) : 0;

  if (fileCount === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 opacity-50">
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
        <span className={`${sectionLabelClass} flex-1 text-muted-foreground`}>{label}</span>
        <span className="text-[10px] text-muted-foreground/60">empty</span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 min-h-[44px] text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`${label}: ${formatTokenEstimate(tokens)} tokens — ${expanded ? "collapse" : "expand"} file list`}
        title={description}
        data-testid={`budget-category-${category}`}
      >
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className={`${sectionLabelClass} flex-1 min-w-0 truncate`}>{label}</span>
        <span className="text-xs font-semibold text-foreground tabular-nums">
          {formatTokenEstimate(tokens)}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        )}
      </button>
      {/* Progress bar */}
      <div className="mx-4 h-0.5 rounded-full bg-muted/60">
        <div
          className="h-0.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
          aria-hidden="true"
        />
      </div>
      {/* Expanded file list */}
      {expanded && files.length > 0 && (
        <div className="mt-1 mb-1 space-y-0.5">
          {files.map((file) => (
            <div
              key={file.path}
              className="flex items-center gap-2 pl-8 pr-4 py-1"
              data-testid={`budget-file-${file.name}`}
            >
              <FileText className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
              <span
                className="flex-1 min-w-0 truncate text-[10px] text-muted-foreground"
                title={file.path}
              >
                {file.name}
              </span>
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                {formatSize(file.bytes)}
              </span>
              <span className="text-[10px] font-medium text-foreground/70 tabular-nums">
                {formatTokenEstimate(file.tokens)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * ContextBudgetCard — Phase 1 visualization panel.
 *
 * Shows a donut chart and per-category breakdown of estimated token costs
 * for an agent's workspace files. All data is based on file sizes;
 * actual tokens injected depend on gateway context policy.
 */
export const ContextBudgetCard = memo(function ContextBudgetCard({
  agentId,
  client,
  status,
}: ContextBudgetCardProps) {
  const { categories, totalTokens, loading, error, refresh } = useContextBudget(agentId);

  // Build donut segments from categories
  const segments: DonutSegment[] = BUDGET_CATEGORY_ORDER.map((cat) => ({
    value: categories[cat].tokens,
    color: CATEGORY_META[cat].color,
    label: CATEGORY_META[cat].label,
  }));

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <h2 className={`${sectionLabelClass} flex-1`}>Context Budget</h2>
        <IconButton
          onClick={() => void refresh()}
          aria-label="Refresh context budget"
          data-testid="budget-refresh-btn"
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </IconButton>
      </div>

      {/* Error state */}
      {error && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !totalTokens && (
        <div className="space-y-3 px-4 pb-4">
          <div className="flex justify-center py-2">
            <Skeleton className="h-[120px] w-[120px] rounded-full" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6 w-full rounded" />
          ))}
        </div>
      )}

      {/* Chart + breakdown */}
      {!loading || totalTokens > 0 ? (
        <div className="flex flex-col gap-0">
          {/* Donut chart + legend */}
          <div className="flex items-center gap-4 px-4 pb-3">
            <div className="flex-shrink-0">
              <DonutChart
                segments={segments}
                centerLabel={formatTokenEstimate(totalTokens)}
                centerSublabel="total tokens"
                size={120}
                radius={48}
                thickness={18}
              />
            </div>
            {/* Legend */}
            <div className="min-w-0 flex-1 space-y-1.5">
              {BUDGET_CATEGORY_ORDER.map((cat) => {
                const meta = CATEGORY_META[cat];
                const catData = categories[cat];
                const pct = totalTokens > 0 ? Math.round((catData.tokens / totalTokens) * 100) : 0;
                return (
                  <div key={cat} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: meta.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-semibold tabular-nums text-foreground">
                      {pct > 0 ? `${pct}%` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 mb-1 border-t border-border/50" />

          {/* Per-category breakdown */}
          <div className="space-y-0.5 pb-4">
            {BUDGET_CATEGORY_ORDER.map((cat) => {
              const catData = categories[cat];
              const meta = CATEGORY_META[cat];
              return (
                <CategoryRow
                  key={cat}
                  category={cat}
                  tokens={catData.tokens}
                  totalTokens={totalTokens}
                  fileCount={catData.files.length}
                  color={meta.color}
                  label={meta.label}
                  description={meta.description}
                  files={catData.files}
                />
              );
            })}
          </div>

          {/* Footer disclaimer */}
          <div className="mx-4 rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
            <p className="text-[9px] leading-relaxed text-muted-foreground/70">
              Estimates based on file size (~4 bytes/token). Actual tokens injected
              depend on gateway context policy and per-file mode overrides below.
            </p>
          </div>

          {/* Empty state */}
          {totalTokens === 0 && !loading && !error && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No workspace files found for this agent.</p>
            </div>
          )}
        </div>
      ) : null}

      {/* Phase 2: Per-file context mode controls */}
      {agentId && client && status && (
        <>
          <div className="mx-4 my-2 border-t border-border/50" />
          <ContextProfileEditor agentId={agentId} client={client} status={status} />
        </>
      )}
    </div>
  );
});
