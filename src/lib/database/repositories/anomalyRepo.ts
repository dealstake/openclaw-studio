/**
 * Database repository for agent_anomalies table (Phase 2 — Anomaly Scoring).
 *
 * Supports:
 *  - Inserting detected anomalies (INSERT OR IGNORE — idempotent on event+metric)
 *  - Querying recent anomalies for an agent (active + dismissed)
 *  - Dismissing a single anomaly by ID
 *  - Dismissing all anomalies for an agent
 *  - Counting active (non-dismissed) anomalies (for badge counts)
 */

import { eq, and, desc, gte } from "drizzle-orm";

import { agentAnomalies, activityEvents } from "../schema";
import type { StudioDb } from "../index";
import type { AgentAnomaly, AnomalyMetric, AnomalySeverity } from "@/features/activity/lib/anomalyTypes";

// ─── Row ↔ Domain Converters ─────────────────────────────────────────────────

function rowToAnomaly(
  row: typeof agentAnomalies.$inferSelect,
  sessionKey?: string | null
): AgentAnomaly {
  return {
    id: row.id,
    agentId: row.agentId,
    taskId: row.taskId,
    taskName: row.taskName,
    eventId: row.eventId,
    eventTimestamp: row.eventTimestamp,
    metric: row.metric as AnomalyMetric,
    observedValue: row.observedValue,
    baselineMean: row.baselineMean,
    baselineStdDev: row.baselineStdDev,
    zScore: row.zScore,
    severity: row.severity as AnomalySeverity,
    explanation: row.explanation,
    sessionKey: sessionKey ?? null,
    dismissed: row.dismissed === 1,
    detectedAt: row.detectedAt,
  };
}

// ─── Repository ──────────────────────────────────────────────────────────────

/**
 * Insert a new anomaly row. Uses onConflictDoNothing to be idempotent on the
 * UUID primary key.
 */
export function insertAnomaly(db: StudioDb, anomaly: AgentAnomaly): void {
  db.insert(agentAnomalies)
    .values({
      id: anomaly.id,
      agentId: anomaly.agentId,
      taskId: anomaly.taskId,
      taskName: anomaly.taskName,
      eventId: anomaly.eventId,
      eventTimestamp: anomaly.eventTimestamp,
      metric: anomaly.metric,
      observedValue: anomaly.observedValue,
      baselineMean: anomaly.baselineMean,
      baselineStdDev: anomaly.baselineStdDev,
      zScore: anomaly.zScore,
      severity: anomaly.severity,
      explanation: anomaly.explanation,
      dismissed: anomaly.dismissed ? 1 : 0,
      detectedAt: anomaly.detectedAt,
    })
    .onConflictDoNothing()
    .run();
}

/**
 * Insert multiple anomalies. Idempotent.
 */
export function insertAnomalies(db: StudioDb, anomalies: AgentAnomaly[]): void {
  if (anomalies.length === 0) return;
  for (const anomaly of anomalies) {
    insertAnomaly(db, anomaly);
  }
}

/**
 * Query recent anomalies for an agent, ordered by most recent first.
 *
 * @param agentId    - Agent to filter by
 * @param options.limitDays   - Only return anomalies from the last N days (default: 30)
 * @param options.includeAll  - Include dismissed anomalies (default: false)
 * @param options.limit       - Max rows to return (default: 100)
 */
export function queryAnomalies(
  db: StudioDb,
  agentId: string,
  options: {
    limitDays?: number;
    includeAll?: boolean;
    limit?: number;
  } = {}
): AgentAnomaly[] {
  const { limitDays = 30, includeAll = false, limit = 100 } = options;

  const cutoffMs = Date.now() - limitDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const conditions = [
    eq(agentAnomalies.agentId, agentId),
    gte(agentAnomalies.detectedAt, cutoffIso),
    ...(includeAll ? [] : [eq(agentAnomalies.dismissed, 0)]),
  ];

  const rows = db
    .select({
      anomaly: agentAnomalies,
      sessionKey: activityEvents.sessionKey,
    })
    .from(agentAnomalies)
    .leftJoin(activityEvents, eq(agentAnomalies.eventId, activityEvents.id))
    .where(and(...conditions))
    .orderBy(desc(agentAnomalies.detectedAt))
    .limit(limit)
    .all();

  return rows.map((r) => rowToAnomaly(r.anomaly, r.sessionKey));
}

/**
 * Count active (non-dismissed) anomalies for an agent in the last N days.
 * Useful for badge counts without fetching full rows.
 */
export function countActiveAnomalies(
  db: StudioDb,
  agentId: string,
  limitDays = 30
): number {
  const cutoffMs = Date.now() - limitDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const rows = db
    .select({ id: agentAnomalies.id })
    .from(agentAnomalies)
    .where(
      and(
        eq(agentAnomalies.agentId, agentId),
        eq(agentAnomalies.dismissed, 0),
        gte(agentAnomalies.detectedAt, cutoffIso)
      )
    )
    .all();

  return rows.length;
}

/**
 * Dismiss a single anomaly by ID. Returns true if a row was updated.
 */
export function dismissAnomaly(db: StudioDb, id: string): boolean {
  const result = db
    .update(agentAnomalies)
    .set({ dismissed: 1 })
    .where(eq(agentAnomalies.id, id))
    .run();

  return result.changes > 0;
}

/**
 * Dismiss all active anomalies for a specific (agent, task) pair.
 * Used by "snooze task" — suppresses all current alerts for one task.
 * Returns the number of rows updated.
 */
export function dismissByTaskId(db: StudioDb, agentId: string, taskId: string): number {
  const result = db
    .update(agentAnomalies)
    .set({ dismissed: 1 })
    .where(
      and(
        eq(agentAnomalies.agentId, agentId),
        eq(agentAnomalies.taskId, taskId),
        eq(agentAnomalies.dismissed, 0)
      )
    )
    .run();

  return result.changes;
}

/**
 * Dismiss all active anomalies for an agent.
 * Returns the number of rows updated.
 */
export function dismissAllAnomalies(db: StudioDb, agentId: string): number {
  const result = db
    .update(agentAnomalies)
    .set({ dismissed: 1 })
    .where(
      and(
        eq(agentAnomalies.agentId, agentId),
        eq(agentAnomalies.dismissed, 0)
      )
    )
    .run();

  return result.changes;
}
