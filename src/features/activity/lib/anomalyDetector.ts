/**
 * Pure anomaly detection engine for Agent Anomaly Detection (Phase 2).
 *
 * Compares a single activity event against a stored AgentBaseline using
 * Z-score analysis. Flags metrics that deviate >3σ from the baseline mean.
 *
 * No React, no DB — fully testable in isolation.
 *
 * Z-score formula:  z = (observed − mean) / stdDev
 * Thresholds:
 *   z ≥ 3σ  → "warning"  (statistically significant)
 *   z ≥ 5σ  → "critical" (extreme deviation)
 *
 * Edge cases:
 *   - stdDev = 0: no variance in the window → skip metric (can't score)
 *   - sampleCount < 3: too few samples → skip metric (noise, not signal)
 *   - observed = 0 and mean = 0: skip (nothing to compare)
 */

import { randomUUID } from "crypto";
import type { ActivityEvent } from "./activityTypes";
import type {
  AgentBaseline,
  AgentAnomaly,
  AnomalyMetric,
  AnomalySeverity,
  AnomalyScoreResult,
  MetricStats,
} from "./anomalyTypes";
import { estimateCostUsd } from "@/features/playground/lib/costEstimator";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Z-score threshold for "warning" severity (3 standard deviations) */
const THRESHOLD_WARNING = 3;
/** Z-score threshold for "critical" severity (5 standard deviations) */
const THRESHOLD_CRITICAL = 5;
/** Minimum sample count to trust a baseline for scoring */
const MIN_SAMPLE_COUNT = 3;

// ─── Metric Extractors ────────────────────────────────────────────────────────

/** Extract observed totalTokens from a live event. */
function observedTotalTokens(event: ActivityEvent): number | null {
  const dbIn = event.tokensIn ?? 0;
  const dbOut = event.tokensOut ?? 0;
  const metaIn = event.meta?.tokensIn ?? 0;
  const metaOut = event.meta?.tokensOut ?? 0;
  const total = dbIn + dbOut > 0 ? dbIn + dbOut : metaIn + metaOut;
  return total > 0 ? total : null;
}

/** Extract observed costUsd from a live event. Returns null if model unknown. */
function observedCostUsd(event: ActivityEvent): number | null {
  const model = event.model;
  if (!model) return null;
  const tokensIn = event.tokensIn ?? event.meta?.tokensIn ?? 0;
  const tokensOut = event.tokensOut ?? event.meta?.tokensOut ?? 0;
  if (tokensIn === 0 && tokensOut === 0) return null;
  return estimateCostUsd(model, tokensIn, tokensOut);
}

/** Extract observed durationMs from a live event. */
function observedDurationMs(event: ActivityEvent): number | null {
  const d = event.meta?.durationMs;
  return typeof d === "number" && d > 0 ? d : null;
}

/** Extract observed errorRate (1 if error, 0 otherwise). */
function observedErrorRate(event: ActivityEvent): number {
  return event.status === "error" ? 1 : 0;
}

// ─── Z-Score Computation ──────────────────────────────────────────────────────

/** Compute Z-score. Returns null if baseline is unsuitable for scoring. */
function zScore(observed: number, stats: MetricStats): number | null {
  if (stats.sampleCount < MIN_SAMPLE_COUNT) return null;
  if (stats.stdDev === 0) return null; // no variance → can't score
  return (observed - stats.mean) / stats.stdDev;
}

/** Map a Z-score to a severity level. Returns null if below warning threshold. */
function severityFromZ(z: number): AnomalySeverity | null {
  const absZ = Math.abs(z);
  if (absZ >= THRESHOLD_CRITICAL) return "critical";
  if (absZ >= THRESHOLD_WARNING) return "warning";
  return null;
}

// ─── Explanation Generation ───────────────────────────────────────────────────

/** Build a human-readable explanation for an anomaly. */
function buildExplanation(
  metric: AnomalyMetric,
  taskName: string,
  observed: number,
  baselineMean: number,
  z: number
): string {
  const direction = z > 0 ? "above" : "below";
  const multiplier =
    baselineMean !== 0
      ? (Math.abs(observed) / Math.abs(baselineMean)).toFixed(1) + "\u00d7"
      : "\u221e";

  switch (metric) {
    case "totalTokens":
      return (
        `Tokens for '${taskName}' was ${Math.round(observed).toLocaleString()}, ` +
        `${multiplier} ${direction} the baseline average ` +
        `of ${Math.round(baselineMean).toLocaleString()}`
      );
    case "costUsd":
      return (
        `Cost for '${taskName}' was $${observed.toFixed(4)}, ` +
        `${multiplier} ${direction} the baseline average of $${baselineMean.toFixed(4)}`
      );
    case "durationMs": {
      const obs =
        observed >= 60_000
          ? `${(observed / 60_000).toFixed(1)}m`
          : `${(observed / 1_000).toFixed(1)}s`;
      const avg =
        baselineMean >= 60_000
          ? `${(baselineMean / 60_000).toFixed(1)}m`
          : `${(baselineMean / 1_000).toFixed(1)}s`;
      return (
        `Duration for '${taskName}' was ${obs}, ` +
        `${multiplier} ${direction} the baseline average of ${avg}`
      );
    }
    case "errorRate":
      return (
        `'${taskName}' threw an error (error rate spike detected). ` +
        `Baseline error rate is ${(baselineMean * 100).toFixed(1)}%`
      );
  }
}

// ─── Main Scoring Function ────────────────────────────────────────────────────

/**
 * Score a single activity event against a stored baseline.
 *
 * For each tracked metric, computes the Z-score and flags any that exceed
 * THRESHOLD_WARNING (3\u03c3). Returns all flagged anomalies plus scoring metadata.
 *
 * @param event    - The activity event just completed
 * @param baseline - The stored baseline for this (agentId, taskId) pair.
 *                   Pass null if no baseline exists.
 * @returns AnomalyScoreResult with detected anomalies and metadata
 */
export function scoreEventAgainstBaseline(
  event: ActivityEvent,
  baseline: AgentBaseline | null
): AnomalyScoreResult {
  if (!baseline) {
    return { anomalies: [], metricsChecked: [], noBaseline: true };
  }

  const detectedAt = new Date().toISOString();
  const agentId = event.agentId ?? baseline.agentId;
  const taskName = event.taskName || baseline.taskName;

  const anomalies: AgentAnomaly[] = [];
  const metricsChecked: AnomalyMetric[] = [];

  // ── totalTokens ────────────────────────────────────────────────────────────
  const tokens = observedTotalTokens(event);
  if (tokens !== null) {
    metricsChecked.push("totalTokens");
    const z = zScore(tokens, baseline.totalTokens);
    if (z !== null) {
      const severity = severityFromZ(z);
      if (severity) {
        anomalies.push({
          id: randomUUID(),
          agentId,
          taskId: event.taskId,
          taskName,
          eventId: event.id,
          eventTimestamp: event.timestamp,
          metric: "totalTokens",
          observedValue: tokens,
          baselineMean: baseline.totalTokens.mean,
          baselineStdDev: baseline.totalTokens.stdDev,
          zScore: z,
          severity,
          explanation: buildExplanation("totalTokens", taskName, tokens, baseline.totalTokens.mean, z),
          dismissed: false,
          detectedAt,
        });
      }
    }
  }

  // ── costUsd ────────────────────────────────────────────────────────────────
  const cost = observedCostUsd(event);
  if (cost !== null) {
    metricsChecked.push("costUsd");
    const z = zScore(cost, baseline.costUsd);
    if (z !== null) {
      const severity = severityFromZ(z);
      if (severity) {
        anomalies.push({
          id: randomUUID(),
          agentId,
          taskId: event.taskId,
          taskName,
          eventId: event.id,
          eventTimestamp: event.timestamp,
          metric: "costUsd",
          observedValue: cost,
          baselineMean: baseline.costUsd.mean,
          baselineStdDev: baseline.costUsd.stdDev,
          zScore: z,
          severity,
          explanation: buildExplanation("costUsd", taskName, cost, baseline.costUsd.mean, z),
          dismissed: false,
          detectedAt,
        });
      }
    }
  }

  // ── durationMs ─────────────────────────────────────────────────────────────
  const duration = observedDurationMs(event);
  if (duration !== null) {
    metricsChecked.push("durationMs");
    const z = zScore(duration, baseline.durationMs);
    if (z !== null) {
      const severity = severityFromZ(z);
      if (severity) {
        anomalies.push({
          id: randomUUID(),
          agentId,
          taskId: event.taskId,
          taskName,
          eventId: event.id,
          eventTimestamp: event.timestamp,
          metric: "durationMs",
          observedValue: duration,
          baselineMean: baseline.durationMs.mean,
          baselineStdDev: baseline.durationMs.stdDev,
          zScore: z,
          severity,
          explanation: buildExplanation("durationMs", taskName, duration, baseline.durationMs.mean, z),
          dismissed: false,
          detectedAt,
        });
      }
    }
  }

  // ── errorRate ──────────────────────────────────────────────────────────────
  const errorRate = observedErrorRate(event);
  metricsChecked.push("errorRate");
  if (errorRate === 1 && baseline.errorRate.sampleCount >= MIN_SAMPLE_COUNT) {
    const z = zScore(errorRate, baseline.errorRate);
    if (z !== null) {
      const severity = severityFromZ(z);
      if (severity) {
        anomalies.push({
          id: randomUUID(),
          agentId,
          taskId: event.taskId,
          taskName,
          eventId: event.id,
          eventTimestamp: event.timestamp,
          metric: "errorRate",
          observedValue: errorRate,
          baselineMean: baseline.errorRate.mean,
          baselineStdDev: baseline.errorRate.stdDev,
          zScore: z,
          severity,
          explanation: buildExplanation("errorRate", taskName, errorRate, baseline.errorRate.mean, z),
          dismissed: false,
          detectedAt,
        });
      }
    }
  }

  return { anomalies, metricsChecked, noBaseline: false };
}
