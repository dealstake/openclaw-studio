/**
 * Pure baseline computation for Agent Anomaly Detection.
 *
 * Computes rolling (mean, stdDev, sampleCount) for each tracked metric
 * from a window of ActivityEvent records. No React imports — fully testable.
 *
 * Metrics tracked per (agentId, taskId) pair:
 *  • totalTokens  — tokensIn + tokensOut per run
 *  • costUsd      — estimated USD cost (via MODEL_PRICING lookup)
 *  • durationMs   — meta.durationMs per run
 *  • errorRate    — fraction of errored runs in the window (single sample = 0 or 1)
 */

import type { ActivityEvent } from "./activityTypes";
import type { AgentBaseline, MetricStats } from "./anomalyTypes";
import { estimateCostUsd } from "@/features/playground/lib/costEstimator";

// ─── Statistical Helpers ─────────────────────────────────────────────────────

/**
 * Compute population mean + standard deviation from a numeric array.
 * Returns zeros for empty or single-element arrays (no variance possible).
 */
export function computeMetricStats(values: number[]): MetricStats {
  const sampleCount = values.length;
  if (sampleCount === 0) {
    return { mean: 0, stdDev: 0, sampleCount: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / sampleCount;

  if (sampleCount === 1) {
    return { mean, stdDev: 0, sampleCount };
  }

  // Population standard deviation (not sample) — we have the full window
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sampleCount;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev, sampleCount };
}

// ─── Per-Run Metric Extraction ───────────────────────────────────────────────

/** Extract total token count from an activity event. */
function extractTotalTokens(event: ActivityEvent): number {
  const dbIn = event.tokensIn ?? 0;
  const dbOut = event.tokensOut ?? 0;
  // Also check meta (some events store tokens there)
  const metaIn = event.meta?.tokensIn ?? 0;
  const metaOut = event.meta?.tokensOut ?? 0;
  const resolved = dbIn + dbOut > 0 ? dbIn + dbOut : metaIn + metaOut;
  return resolved;
}

/** Extract duration in ms from an activity event. */
function extractDurationMs(event: ActivityEvent): number | null {
  // Prefer meta.durationMs (set by transcript capture)
  const metaDuration = event.meta?.durationMs;
  if (typeof metaDuration === "number" && metaDuration > 0) {
    return metaDuration;
  }
  return null;
}

/** Estimate cost in USD for an activity event. Returns null if model is unknown. */
function extractCostUsd(event: ActivityEvent): number | null {
  const model = event.model;
  if (!model) return null;

  const tokensIn = event.tokensIn ?? event.meta?.tokensIn ?? 0;
  const tokensOut = event.tokensOut ?? event.meta?.tokensOut ?? 0;

  if (tokensIn === 0 && tokensOut === 0) return null;
  return estimateCostUsd(model, tokensIn, tokensOut);
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/** Group runs per (agentId, taskId) pair for bulk baseline computation. */
interface TaskRunGroup {
  agentId: string;
  taskId: string;
  taskName: string;
  events: ActivityEvent[];
}

/**
 * Compute behavioral baselines for all (agentId, taskId) pairs found in
 * the provided events slice.
 *
 * @param agentId   - Agent to compute baselines for (used as fallback when
 *                    events lack an agentId field)
 * @param events    - Activity events within the rolling window (caller is
 *                    responsible for applying the time filter)
 * @param windowDays - Window size in days (informational, stored in baseline)
 * @returns         Array of AgentBaseline, one per (agentId, taskId) pair
 */
export function computeBaselinesFromEvents(
  agentId: string,
  events: ActivityEvent[],
  windowDays = 7
): AgentBaseline[] {
  if (events.length === 0) return [];

  const computedAt = new Date().toISOString();

  // Group events by (agentId, taskId)
  const groupMap = new Map<string, TaskRunGroup>();
  for (const event of events) {
    const effectiveAgentId = event.agentId ?? agentId;
    const taskId = event.taskId || "unknown";
    const key = `${effectiveAgentId}:${taskId}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        agentId: effectiveAgentId,
        taskId,
        taskName: event.taskName || taskId,
        events: [],
      });
    }
    const group = groupMap.get(key)!;
    group.events.push(event);
    // Keep the most recent taskName (last event wins)
    if (event.taskName) group.taskName = event.taskName;
  }

  const baselines: AgentBaseline[] = [];

  for (const [compositeId, group] of groupMap) {
    const runs = group.events;

    // ── Token samples ──────────────────────────────────────────────────────
    const tokenValues = runs.map(extractTotalTokens);

    // ── Cost samples ───────────────────────────────────────────────────────
    const costValues = runs
      .map(extractCostUsd)
      .filter((v): v is number => v !== null);

    // ── Duration samples ───────────────────────────────────────────────────
    const durationValues = runs
      .map(extractDurationMs)
      .filter((v): v is number => v !== null);

    // ── Error rate ─────────────────────────────────────────────────────────
    // Treat each run as 0 (success/partial) or 1 (error).
    // The mean of this binary array is the error rate over the window.
    const errorValues = runs.map((e) => (e.status === "error" ? 1 : 0));

    baselines.push({
      id: compositeId,
      agentId: group.agentId,
      taskId: group.taskId,
      taskName: group.taskName,
      totalTokens: computeMetricStats(tokenValues),
      costUsd: computeMetricStats(costValues),
      durationMs: computeMetricStats(durationValues),
      errorRate: computeMetricStats(errorValues),
      computedAt,
      windowDays,
      sensitivity: 3, // default; preserved on upsert if already customized
    });
  }

  return baselines;
}
