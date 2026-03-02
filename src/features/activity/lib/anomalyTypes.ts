/**
 * Types for the Agent Anomaly Detection & Baseline Alerts feature.
 *
 * Phase 1: Baseline computation — statistical models per (agent, task) pair.
 * Phase 2: Anomaly scoring against stored baselines (>3σ Z-score detection).
 */

// ─── Statistical Primitives ──────────────────────────────────────────────

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

// ─── Baseline API Response Types ─────────────────────────────────────────────────

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

// ─── Anomalies ───────────────────────────────────────────────────────────────

/** Which metric triggered the anomaly. */
export type AnomalyMetric = "totalTokens" | "costUsd" | "durationMs" | "errorRate";

/**
 * Severity of a flagged anomaly.
 * - "warning"  → Z-score ≥ 3σ (statistically significant, worth noting)
 * - "critical" → Z-score ≥ 5σ (extreme deviation, needs immediate attention)
 */
export type AnomalySeverity = "warning" | "critical";

/**
 * A single flagged behavioral anomaly.
 *
 * Created when an activity event's metric deviates >3σ from the stored
 * baseline for that (agentId, taskId) pair.
 */
export interface AgentAnomaly {
  /** UUID primary key */
  id: string;
  agentId: string;
  taskId: string;
  /** Human-readable task name (from the event) */
  taskName: string;
  /** Foreign key to the triggering activity_events.id */
  eventId: string;
  /** ISO timestamp of the triggering event */
  eventTimestamp: string;
  /** Which metric exceeded the threshold */
  metric: AnomalyMetric;
  /** The observed value for the metric in this run */
  observedValue: number;
  /** Baseline mean over the rolling window */
  baselineMean: number;
  /** Baseline standard deviation over the rolling window */
  baselineStdDev: number;
  /**
   * Z-score: (observed - mean) / stdDev.
   * Positive means higher than baseline, negative means lower.
   */
  zScore: number;
  severity: AnomalySeverity;
  /**
   * Human-readable explanation, e.g.:
   * "Cost for 'Daily Summary' was $0.52, 4.5× above the baseline average of $0.11"
   */
  explanation: string;
  /** Session key of the triggering event (for trace navigation) */
  sessionKey?: string | null;
  /** Whether the user has dismissed this alert */
  dismissed: boolean;
  /** ISO timestamp when the anomaly was detected */
  detectedAt: string;
}

// ─── Anomaly Scoring Result ─────────────────────────────────────────────────────

/** Result of scoring a single activity event against its baseline. */
export interface AnomalyScoreResult {
  /** Anomalies detected (one per metric that exceeded threshold). */
  anomalies: AgentAnomaly[];
  /** Metrics that were checked (whether or not they triggered). */
  metricsChecked: AnomalyMetric[];
  /** True if no baseline existed for this (agentId, taskId) pair. */
  noBaseline: boolean;
}

// ─── Anomaly API Response Types ──────────────────────────────────────────────────

/** Response body for GET /api/activity/alerts */
export interface AnomaliesResponse {
  agentId: string;
  anomalies: AgentAnomaly[];
  /** Total count including dismissed */
  total: number;
  /** Count of non-dismissed anomalies */
  activeCount: number;
}

/** Response body for POST /api/activity/alerts (score a new event) */
export interface AlertScoreResponse {
  agentId: string;
  eventId: string;
  result: AnomalyScoreResult;
  /** Number of new anomaly rows written to DB */
  anomaliesWritten: number;
}
