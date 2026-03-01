/**
 * Database repository for agent_baselines table.
 *
 * Supports:
 *  - Upserting computed baselines (INSERT OR REPLACE)
 *  - Querying baselines for an agent
 *  - Computing and storing baselines from the activity_events table
 */

import { eq, gte, desc } from "drizzle-orm";

import { agentBaselines, activityEvents } from "../schema";
import type { StudioDb } from "../index";
import type { AgentBaseline, BaselineComputeResult } from "@/features/activity/lib/anomalyTypes";
import type { MetricStats } from "@/features/activity/lib/anomalyTypes";
import { computeBaselinesFromEvents } from "@/features/activity/lib/baselineComputer";
import type { ActivityEvent, ActivityMeta } from "@/features/activity/lib/activityTypes";

// ─── Row ↔ Domain Converters ─────────────────────────────────────────────────

function rowToBaseline(row: typeof agentBaselines.$inferSelect): AgentBaseline {
  const toStats = (mean: number, stdDev: number, sampleCount: number): MetricStats => ({
    mean,
    stdDev,
    sampleCount,
  });

  return {
    id: row.id,
    agentId: row.agentId,
    taskId: row.taskId,
    taskName: row.taskName,
    totalTokens: toStats(row.tokensMean, row.tokensStdDev, row.tokensSampleCount),
    costUsd: toStats(row.costMean, row.costStdDev, row.costSampleCount),
    durationMs: toStats(row.durationMean, row.durationStdDev, row.durationSampleCount),
    errorRate: toStats(row.errorRateMean, row.errorRateStdDev, row.errorRateSampleCount),
    computedAt: row.computedAt,
    windowDays: row.windowDays,
  };
}

// ─── Repository ──────────────────────────────────────────────────────────────

/**
 * Upsert (insert or replace) a single baseline row.
 * Uses the composite `id` ("<agentId>:<taskId>") as the conflict key.
 */
export function upsertBaseline(db: StudioDb, baseline: AgentBaseline): void {
  db.insert(agentBaselines)
    .values({
      id: baseline.id,
      agentId: baseline.agentId,
      taskId: baseline.taskId,
      taskName: baseline.taskName,
      tokensMean: baseline.totalTokens.mean,
      tokensStdDev: baseline.totalTokens.stdDev,
      tokensSampleCount: baseline.totalTokens.sampleCount,
      costMean: baseline.costUsd.mean,
      costStdDev: baseline.costUsd.stdDev,
      costSampleCount: baseline.costUsd.sampleCount,
      durationMean: baseline.durationMs.mean,
      durationStdDev: baseline.durationMs.stdDev,
      durationSampleCount: baseline.durationMs.sampleCount,
      errorRateMean: baseline.errorRate.mean,
      errorRateStdDev: baseline.errorRate.stdDev,
      errorRateSampleCount: baseline.errorRate.sampleCount,
      computedAt: baseline.computedAt,
      windowDays: baseline.windowDays,
    })
    .onConflictDoUpdate({
      target: agentBaselines.id,
      set: {
        taskName: baseline.taskName,
        tokensMean: baseline.totalTokens.mean,
        tokensStdDev: baseline.totalTokens.stdDev,
        tokensSampleCount: baseline.totalTokens.sampleCount,
        costMean: baseline.costUsd.mean,
        costStdDev: baseline.costUsd.stdDev,
        costSampleCount: baseline.costUsd.sampleCount,
        durationMean: baseline.durationMs.mean,
        durationStdDev: baseline.durationMs.stdDev,
        durationSampleCount: baseline.durationMs.sampleCount,
        errorRateMean: baseline.errorRate.mean,
        errorRateStdDev: baseline.errorRate.stdDev,
        errorRateSampleCount: baseline.errorRate.sampleCount,
        computedAt: baseline.computedAt,
        windowDays: baseline.windowDays,
      },
    })
    .run();
}

/**
 * Query all stored baselines for an agent, ordered by most recently computed.
 */
export function queryBaselines(db: StudioDb, agentId: string): AgentBaseline[] {
  const rows = db
    .select()
    .from(agentBaselines)
    .where(eq(agentBaselines.agentId, agentId))
    .orderBy(desc(agentBaselines.computedAt))
    .all();

  return rows.map(rowToBaseline);
}

/**
 * Compute baselines from the last `windowDays` of stored activity events,
 * then persist them. Returns the computation result.
 *
 * This is the core "daily recomputation" operation.
 */
export function computeAndStoreBaselines(
  db: StudioDb,
  agentId: string,
  windowDays = 7
): BaselineComputeResult {
  const computedAt = new Date().toISOString();

  // Calculate the cutoff timestamp (windowDays ago)
  const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  // Fetch events within the rolling window
  // Filter to the agent (via agentId column) or events where taskId is non-empty
  // (older events may not have agentId populated — we include them all)
  const rows = db
    .select()
    .from(activityEvents)
    .where(gte(activityEvents.timestamp, cutoffIso))
    .orderBy(desc(activityEvents.timestamp))
    .all();

  // Convert rows to ActivityEvent domain objects
  const events: ActivityEvent[] = rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    taskName: row.taskName,
    taskId: row.taskId,
    projectSlug: row.projectSlug ?? null,
    projectName: row.projectName ?? null,
    status: row.status as ActivityEvent["status"],
    summary: row.summary,
    meta: row.metaJson ? (JSON.parse(row.metaJson) as ActivityMeta) : {},
    sessionKey: row.sessionKey ?? null,
    transcriptJson: null, // not needed for computation
    tokensIn: row.tokensIn ?? null,
    tokensOut: row.tokensOut ?? null,
    model: row.model ?? null,
    agentId: row.agentId ?? agentId,
  }));

  // Compute baselines using pure function
  const baselines = computeBaselinesFromEvents(agentId, events, windowDays);

  // Persist each baseline (upsert)
  for (const baseline of baselines) {
    upsertBaseline(db, baseline);
  }

  return {
    agentId,
    baselines,
    computedAt,
    baselinesWritten: baselines.length,
    eventsAnalyzed: events.length,
  };
}
