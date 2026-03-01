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
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAnomalyAlerts } from "@/features/activity/hooks/useAnomalyAlerts";
import type { AgentAnomaly, AnomalyMetric, AnomalySeverity } from "@/features/activity/lib/anomalyTypes";

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
};

// ─── Severity Styles ──────────────────────────────────────────────────────────

interface SeverityStyle {
  pill: string;
  border: string;
  icon: string;
}

const SEVERITY_STYLES: Record<AnomalySeverity, SeverityStyle> = {
  warning: {
    pill: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-500/20",
    icon: "text-yellow-500",
  },
  critical: {
    pill: "bg-red-500/10 text-red-600 dark:text-red-400",
    border: "border-red-500/20",
    icon: "text-red-500",
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
  }
}

function formatZScore(z: number): string {
  const absZ = Math.abs(z).toFixed(1);
  return z > 0 ? `+${absZ}\u03c3` : `-${absZ}\u03c3`;
}

// ─── Anomaly Card ─────────────────────────────────────────────────────────────

interface AnomalyCardProps {
  anomaly: AgentAnomaly;
  onDismiss: (id: string) => void;
}

const AnomalyCard = memo(function AnomalyCard({ anomaly, onDismiss }: AnomalyCardProps) {
  const styles = SEVERITY_STYLES[anomaly.severity];
  const meta = METRIC_META[anomaly.metric];
  const isAbove = anomaly.zScore > 0;
  const TrendIcon = isAbove ? TrendingUp : TrendingDown;

  const handleDismiss = useCallback(() => {
    onDismiss(anomaly.id);
  }, [anomaly.id, onDismiss]);

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
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${styles.pill}`}
            >
              {anomaly.severity.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={`Dismiss anomaly for ${anomaly.taskName}`}
              className="ml-auto flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all group-hover/anomaly:opacity-100 hover:bg-muted/60 hover:text-foreground"
            >
              <X size={12} />
            </button>
          </div>

          {/* Metric chips */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {meta.icon}
              {meta.label}
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-foreground/80">
              <TrendIcon size={10} className={styles.icon} />
              {formatZScore(anomaly.zScore)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatObserved(anomaly.metric, anomaly.observedValue)}
              {" vs avg "}
              {formatObserved(anomaly.metric, anomaly.baselineMean)}
            </span>
          </div>

          {/* Explanation */}
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {anomaly.explanation}
          </p>

          {/* Timestamp */}
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            {new Date(anomaly.detectedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
});

// ─── Main Panel ───────────────────────────────────────────────────────────────

/**
 * AnomalyPanel — displays recent behavioral anomalies for the selected agent.
 *
 * Phase 2 of the Agent Anomaly Detection feature.
 * Designed to be embedded as an "Alerts" tab inside ActivityPanel (Phase 3).
 */
export const AnomalyPanel = memo(function AnomalyPanel() {
  const { anomalies, activeCount, loading, error, refresh, dismissOne, dismissAll } =
    useAnomalyAlerts();

  const hasAnomalies = anomalies.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} className="text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground">
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
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <CheckCheck size={11} />
              Dismiss all
            </button>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            title="Refresh alerts"
            className="flex min-h-[28px] min-w-[28px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
              />
            ))}
          </div>
        )}

        {loading && anomalies.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={16} className="animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
});
