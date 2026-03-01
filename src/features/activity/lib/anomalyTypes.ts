/**
 * Types for the Agent Anomaly Detection & Baseline Alerts feature.
 *
 * Phase 1: Baseline computation — statistical models per (agent, task) pair.
 * Phase 2 (future): Anomaly scoring against stored baselines.
 */

// ─── Statistical Primitives ──────────────────────────────────────────────────

/** Rolling-window statistics for a single numeric metric. */
export interface MetricStats {
  /** Arithmetic mean over the rolling window */
  mean: number;
  /** Population standard deviation */
  stdDev: number;
  /** Number of samples included in computation */
  sampleCount: number;
}

// ─── Baseline ────────────────────────────────────────────────────────────────

/**
 * Behavioral baseline for a specific (agentId, taskId) pair.
 *
 * Computed from the last `windowDays` days of activity events.
 * Each metric stores (mean, stdDev, sampleCount) to enable Z-score anomaly
 * detection: deviation = (observed - mean) / stdDev.
 */
export interface AgentBaseline {
  /**
   * Stable composite key: `<agentId>:<taskId>`.
   * Primary key in the `agent_baselines` SQLite table.
   */
  id: string;
  agentId: string;
  taskId: string;
  /** Human-readable task name (most recent seen — for display only) */
  taskName: string;
  /** Total tokens per run (tokensIn + tokensOut) */
  totalTokens: MetricStats;
  /** Estimated cost in USD per run (using MODEL_PRICING lookup; 0 if unknown model) */
  costUsd: MetricStats;
  /** Run duration in milliseconds (from meta.durationMs) */
  durationMs: MetricStats;
  /** Error rate: fraction of runs where status === "error" (0.0–1.0) */
  errorRate: MetricStats;
  /** ISO timestamp when this baseline was last computed */
  computedAt: string;
  /** Rolling window in days (default: 7) */
  windowDays: number;
}

// ─── API Response Types ──────────────────────────────────────────────────────

/** Response body for GET /api/activity/baselines */
export interface BaselinesResponse {
  agentId: string;
  baselines: AgentBaseline[];
}

/** Response body for POST /api/activity/baselines (triggers recomputation) */
export interface BaselineComputeResult {
  agentId: string;
  baselines: AgentBaseline[];
  computedAt: string;
  /** Number of task baselines written */
  baselinesWritten: number;
  /** Number of unique activity events used as input */
  eventsAnalyzed: number;
}
