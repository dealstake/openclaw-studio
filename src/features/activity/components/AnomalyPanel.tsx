"use client";

import { memo, useCallback } from "react";
import {
  AlertTriangle,
  CheckCheck,
  RefreshCw,
  X,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Zap,
  AlertCircle,
  FileSearch,
  BellOff,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { openTraceFromKey } from "@/features/sessions/state/traceViewStore";
import type { AgentAnomaly, AgentBaseline, AnomalyMetric, AnomalySeverity } from "@/features/activity/lib/anomalyTypes";
import { TrendSparkline } from "./TrendSparkline";
import { SensitivityPicker } from "./SensitivityPicker";

// ─── Metric Meta ──────────────────────────────────────────────────────────────

interface MetricMeta {
  label: string;
  icon: React.ReactNode;
}

const METRIC_META: Record<AnomalyMetric, MetricMeta> = {
  totalTokens: { label: "Tokens", icon: <Zap size={12} /> },
  costUsd: { label: "Cost", icon: <DollarSign size={12} /> },
  durationMs: { label: "Duration", icon: <Clock size={12} /> },
  errorRate: { label: "Error Rate", icon: <AlertCircle size={12} /> },
  toolErrorRate: { label: "Tool Error Rate", icon: <AlertCircle size={12} /> },
};

// ─── Severity Styles ──────────────────────────────────────────────────────────

interface SeverityStyle {
  pill: string;
  border: string;
  icon: string;
}

const SEVERITY_STYLES: Record<AnomalySeverity, SeverityStyle> = {
  warning: {
    pill: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    border: "border-amber-500/20",
    icon: "text-amber-500",
  },
  critical: {
    pill: "bg-destructive/10 text-red-800 dark:text-destructive",
    border: "border-destructive/20",
    icon: "text-destructive",
  },
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatObserved(metric: AnomalyMetric, value: number): string {
  switch (metric) {
    case "totalTokens":
      return value >= 1_000
        ? `${(value / 1_000).toFixed(1)}k tokens`
        : `${Math.round(value)} tokens`;
    case "costUsd":
      return `$${value.toFixed(4)}`;
    case "durationMs":
      return value >= 60_000
        ? `${(value / 60_000).toFixed(1)}m`
        : `${(value / 1_000).toFixed(1)}s`;
    case "errorRate":
      return value === 1 ? "error" : `${(value * 100).toFixed(0)}%`;
    case "toolErrorRate":
      return `${(value * 100).toFixed(1)}%`;
  }
}

function formatZScore(z: number): string {
  const absZ = Math.abs(z).toFixed(1);
  return z > 0 ? `+${absZ}\u03c3` : `-${absZ}\u03c3`;
}

// ─── Sparkline Helpers ────────────────────────────────────────────────────────

/**
 * Build synthetic sparkline values from baseline stats.
 * Shows ~6 points hovering near the mean, then the observed anomaly value.
 * Uses a seeded pseudo-random based on anomaly ID for consistency.
 */
function buildSparklineValues(anomaly: AgentAnomaly): number[] {
  const { baselineMean, baselineStdDev, observedValue, id } = anomaly;
  // Simple hash from id for deterministic "jitter"
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    // Deterministic jitter within ±1σ
    const jitter = (((hash >> (i * 3)) & 0x7) / 7 - 0.5) * 2 * baselineStdDev;
    points.push(Math.max(0, baselineMean + jitter));
  }
  points.push(observedValue);
  return points;
}

// ─── Anomaly Card ─────────────────────────────────────────────────────────────

interface AnomalyCardProps {
  anomaly: AgentAnomaly;
  onDismiss: (id: string) => void;
  onInvestigate: (anomaly: AgentAnomaly) => void;
  onSnoozeTask: (taskId: string) => void;
}

const AnomalyCard = memo(function AnomalyCard({ anomaly, onDismiss, onInvestigate, onSnoozeTask }: AnomalyCardProps) {
  const styles = SEVERITY_STYLES[anomaly.severity];
  const meta = METRIC_META[anomaly.metric];
  const isAbove = anomaly.zScore > 0;
  const TrendIcon = isAbove ? TrendingUp : TrendingDown;

  const handleDismiss = useCallback(() => {
    onDismiss(anomaly.id);
  }, [anomaly.id, onDismiss]);

  const handleInvestigate = useCallback(() => {
    onInvestigate(anomaly);
  }, [anomaly, onInvestigate]);

  const handleSnooze = useCallback(() => {
    onSnoozeTask(anomaly.taskId);
  }, [anomaly.taskId, onSnoozeTask]);

  return (
    <div
      className={`group/anomaly rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/30 ${styles.border}`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 flex-shrink-0 ${styles.icon}`}>
          <AlertTriangle size={14} />
        </div>
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-foreground">
              {anomaly.taskName}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${styles.pill}`}
            >
              {anomaly.severity.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={`Dismiss anomaly for ${anomaly.taskName}`}
              className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all group-hover/anomaly:opacity-100 focus-visible:opacity-100 hover:bg-muted/60 hover:text-foreground"
            >
              <X size={12} />
            </button>
          </div>

          {/* Metric chips */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground">
              {meta.icon}
              {meta.label}
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-md bg-muted/60 px-1.5 py-0.5 text-xs font-sans text-foreground/80">
              <TrendIcon size={10} className={styles.icon} />
              {formatZScore(anomaly.zScore)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatObserved(anomaly.metric, anomaly.observedValue)}
              {" vs avg "}
              {formatObserved(anomaly.metric, anomaly.baselineMean)}
            </span>
          </div>

          {/* Sparkline + explanation — stack vertically on mobile */}
          <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <TrendSparkline
              values={buildSparklineValues(anomaly)}
              width={64}
              height={18}
              color={anomaly.severity === "critical" ? "var(--color-destructive)" : "var(--color-accent)"}
              highlightLast
              className="flex-shrink-0"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {anomaly.explanation}
            </p>
          </div>

          {/* Timestamp + Actions — wrap on mobile */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground/80">
              {new Date(anomaly.detectedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="mx-1 hidden text-border sm:inline">·</span>
            {anomaly.sessionKey && (
              <button
                type="button"
                onClick={handleInvestigate}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                title="View session trace"
              >
                <FileSearch size={11} />
                Investigate
              </button>
            )}
            <button
              type="button"
              onClick={handleSnooze}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              title={`Dismiss all alerts for ${anomaly.taskName}`}
            >
              <BellOff size={11} />
              Snooze task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Main Panel ───────────────────────────────────────────────────────────────

/**
 * Props for AnomalyPanel — data is lifted to ActivityPanel so the tab badge
 * can show the active count without mounting this component.
 */
export interface AnomalyPanelProps {
  anomalies: AgentAnomaly[];
  activeCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  dismissOne: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
  snoozeTask: (taskId: string) => Promise<void>;
  /** Baselines with sensitivity info for per-task config */
  baselines: AgentBaseline[];
  /** Update sensitivity for a specific baseline */
  setSensitivity: (baselineId: string, sensitivity: number) => Promise<void>;
}

/**
 * AnomalyPanel — displays recent behavioral anomalies for the selected agent.
 *
 * Phase 3: Embedded as "Alerts" tab inside ActivityPanel.
 */
export const AnomalyPanel = memo(function AnomalyPanel({
  anomalies,
  activeCount,
  loading,
  error,
  refresh,
  dismissOne,
  dismissAll,
  snoozeTask,
  baselines,
  setSensitivity,
}: AnomalyPanelProps) {
  const hasAnomalies = anomalies.length > 0;

  const handleInvestigate = useCallback((anomaly: AgentAnomaly) => {
    if (anomaly.sessionKey) {
      openTraceFromKey(anomaly.sessionKey, anomaly.agentId);
    }
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} className="text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {activeCount > 0
              ? `${activeCount} active alert${activeCount !== 1 ? "s" : ""}`
              : "No active alerts"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hasAnomalies && (
            <button
              type="button"
              onClick={dismissAll}
              title="Dismiss all alerts"
              className="flex min-h-[44px] items-center gap-1 rounded-md px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <CheckCheck size={11} />
              Dismiss all
            </button>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh alerts"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" aria-live="polite" aria-busy={loading}>
        {error && (
          <div className="mx-3 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && !hasAnomalies && (
          <EmptyState
            icon={CheckCheck}
            title="All clear"
            description="No behavioral anomalies detected in the last 30 days."
          />
        )}

        {hasAnomalies && (
          <div className="space-y-1.5 p-2">
            {anomalies.map((anomaly) => (
              <AnomalyCard
                key={anomaly.id}
                anomaly={anomaly}
                onDismiss={dismissOne}
                onInvestigate={handleInvestigate}
                onSnoozeTask={snoozeTask}
              />
            ))}
          </div>
        )}

        {loading && anomalies.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={16} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Sensitivity settings per task */}
        {baselines.length > 0 && (
          <div className="border-t border-border/40 px-3 py-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Sensitivity by task
            </span>
            <div className="space-y-1.5">
              {baselines.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-foreground/80">
                    {b.taskName || b.taskId}
                  </span>
                  <SensitivityPicker
                    value={b.sensitivity}
                    onChange={(v) => setSensitivity(b.id, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
