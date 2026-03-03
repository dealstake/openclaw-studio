import { NextResponse } from "next/server";
import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { withSidecarGetFallback, withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import { getDb } from "@/lib/database";
import * as anomalyRepo from "@/lib/database/repositories/anomalyRepo";
import * as baselineRepo from "@/lib/database/repositories/baselineRepo";
import { scoreEventAgainstBaseline } from "@/features/activity/lib/anomalyDetector";
import type { ActivityEvent, ActivityMeta } from "@/features/activity/lib/activityTypes";
import { activityEvents } from "@/lib/database/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * GET /api/activity/alerts?agentId=<id>&days=<n>&includeAll=<bool>&limit=<n>
 *
 * Returns recent anomalies for the given agent.
 *
 * Response: AnomaliesResponse { agentId, anomalies, total, activeCount }
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    let days = parseInt(url.searchParams.get("days") ?? "30", 10);
    if (isNaN(days) || days < 1) days = 30;
    if (days > 90) days = 90;

    const includeAll = url.searchParams.get("includeAll") === "true";

    let limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
    if (isNaN(limit) || limit < 1) limit = 100;
    if (limit > 500) limit = 500;

    const sidecarParams: Record<string, string> = {
      agentId,
      days: String(days),
      includeAll: String(includeAll),
      limit: String(limit),
    };

    return withSidecarGetFallback("/activity/alerts", sidecarParams, () => {
      const db = getDb();

      const anomalies = anomalyRepo.queryAnomalies(db, agentId, {
        limitDays: days,
        includeAll,
        limit,
      });

      const activeCount = includeAll
        ? anomalies.filter((a) => !a.dismissed).length
        : anomalies.length;

      const total = includeAll
        ? anomalies.length
        : anomalyRepo.countActiveAnomalies(db, agentId, days);

      return { agentId, anomalies, total, activeCount };
    });
  } catch (err) {
    return handleApiError(err, "activity/alerts GET", "Failed to fetch anomaly alerts.");
  }
}

/**
 * POST /api/activity/alerts?agentId=<id>
 *
 * Score a specific activity event against the stored baseline and persist
 * any detected anomalies.
 *
 * Body: { eventId: string }
 *
 * Response: AlertScoreResponse { agentId, eventId, result, anomaliesWritten }
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be JSON with { eventId: string }." },
        { status: 400 }
      );
    }

    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required in request body." },
        { status: 400 }
      );
    }

    return withSidecarMutateFallback(
      "/activity/alerts",
      "POST",
      { agentId, eventId },
      () => {
        const db = getDb();

        // 1. Fetch the activity event from the DB
        const eventRows = db
          .select()
          .from(activityEvents)
          .where(eq(activityEvents.id, eventId))
          .limit(1)
          .all();

        if (eventRows.length === 0) {
          return {
            agentId,
            eventId,
            result: { anomalies: [], metricsChecked: [], noBaseline: false },
            anomaliesWritten: 0,
          };
        }

        const row = eventRows[0];
        const event: ActivityEvent = {
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
          transcriptJson: row.transcriptJson ?? null,
          tokensIn: row.tokensIn ?? null,
          tokensOut: row.tokensOut ?? null,
          model: row.model ?? null,
          agentId: row.agentId ?? agentId,
        };

        // 2. Look up the stored baseline for this (agentId, taskId)
        //    Auto-recompute if baselines are stale (>24h old)
        let baselines = baselineRepo.queryBaselines(db, agentId);
        const staleThreshold = Date.now() - 24 * 60 * 60 * 1000;
        const isStale =
          baselines.length === 0 ||
          baselines.every(
            (b) => new Date(b.computedAt).getTime() < staleThreshold
          );
        if (isStale) {
          const result = baselineRepo.computeAndStoreBaselines(db, agentId, 7);
          baselines = result.baselines;
        }
        const baselineKey = `${event.agentId ?? agentId}:${event.taskId}`;
        const baseline = baselines.find((b) => b.id === baselineKey) ?? null;

        // 3. Score the event against the baseline
        const result = scoreEventAgainstBaseline(event, baseline);

        // 4. Persist detected anomalies
        anomalyRepo.insertAnomalies(db, result.anomalies);

        return {
          agentId,
          eventId,
          result,
          anomaliesWritten: result.anomalies.length,
        };
      }
    );
  } catch (err) {
    return handleApiError(err, "activity/alerts POST", "Failed to score event for anomalies.");
  }
}

/**
 * PATCH /api/activity/alerts?agentId=<id>
 *
 * Dismiss anomalies.
 *   - Body { id: string }        — dismiss a single anomaly
 *   - Body { dismissAll: true }  — dismiss all active anomalies for the agent
 *
 * Response: { dismissed: number }
 */
export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be JSON." },
        { status: 400 }
      );
    }

    return withSidecarMutateFallback(
      "/activity/alerts",
      "PATCH",
      { agentId },
      () => {
        const db = getDb();

        if (body.dismissAll === true) {
          const count = anomalyRepo.dismissAllAnomalies(db, agentId);
          return { dismissed: count };
        }

        // Snooze a specific task — dismiss all alerts for that taskId
        const snoozeTaskId = typeof body.snoozeTaskId === "string" ? body.snoozeTaskId.trim() : "";
        if (snoozeTaskId) {
          const count = anomalyRepo.dismissByTaskId(db, agentId, snoozeTaskId);
          return { dismissed: count };
        }

        const id = typeof body.id === "string" ? body.id.trim() : "";
        if (!id) {
          return NextResponse.json(
            { error: "Provide { id }, { snoozeTaskId }, or { dismissAll: true }." },
            { status: 400 }
          );
        }

        const ok = anomalyRepo.dismissAnomaly(db, id);
        return { dismissed: ok ? 1 : 0 };
      }
    );
  } catch (err) {
    return handleApiError(err, "activity/alerts PATCH", "Failed to dismiss anomaly.");
  }
}
