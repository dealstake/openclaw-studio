import { NextResponse } from "next/server";
import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { withSidecarGetFallback, withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import { getDb } from "@/lib/database";
import * as baselineRepo from "@/lib/database/repositories/baselineRepo";

export const runtime = "nodejs";

/**
 * GET /api/activity/baselines?agentId=<id>&windowDays=<days>
 *
 * Returns the stored behavioral baselines for the given agent.
 * Baselines are computed by the POST endpoint (on-demand) or daily via cron.
 *
 * Response: { agentId, baselines: AgentBaseline[] }
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const sidecarParams: Record<string, string> = { agentId };

    return withSidecarGetFallback("/activity/baselines", sidecarParams, () => {
      const db = getDb();
      let baselines = baselineRepo.queryBaselines(db, agentId);

      // Auto-recompute if baselines are stale (>24h old) or missing
      // queryBaselines sorts by computedAt desc — check newest only
      const staleThreshold = Date.now() - 24 * 60 * 60 * 1000;
      const isStale =
        baselines.length === 0 ||
        new Date(baselines[0].computedAt).getTime() < staleThreshold;
      if (isStale) {
        const result = baselineRepo.computeAndStoreBaselines(db, agentId, 7);
        baselines = result.baselines;
      }

      return { agentId, baselines };
    });
  } catch (err) {
    return handleApiError(err, "activity/baselines GET", "Failed to fetch baselines.");
  }
}

/**
 * POST /api/activity/baselines?agentId=<id>&windowDays=<days>
 *
 * Triggers an on-demand baseline recomputation for the given agent.
 * Reads the last `windowDays` days of activity_events, computes rolling
 * statistics, and persists the results.
 *
 * Optional body: { windowDays?: number }
 *
 * Response: BaselineComputeResult
 *   { agentId, baselines, computedAt, baselinesWritten, eventsAnalyzed }
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    // Parse optional windowDays from query param or body
    let windowDays = parseInt(url.searchParams.get("windowDays") ?? "7", 10);
    if (isNaN(windowDays) || windowDays < 1) windowDays = 7;
    if (windowDays > 90) windowDays = 90; // cap at 90 days

    // Also check body for windowDays override
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // body is optional — ignore parse errors
    }
    if (typeof body.windowDays === "number" && body.windowDays > 0) {
      windowDays = Math.min(Math.max(body.windowDays, 1), 90);
    }

    return withSidecarMutateFallback(
      "/activity/baselines",
      "POST",
      { agentId, windowDays },
      () => {
        const db = getDb();
        return baselineRepo.computeAndStoreBaselines(db, agentId, windowDays);
      }
    );
  } catch (err) {
    return handleApiError(err, "activity/baselines POST", "Failed to compute baselines.");
  }
}

/**
 * PATCH /api/activity/baselines?agentId=<id>
 *
 * Update sensitivity for a specific baseline.
 * Body: { baselineId: string, sensitivity: number (1|2|3) }
 *
 * Response: { updated: boolean, baselineId, sensitivity }
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
        { error: "Request body must be JSON with { baselineId, sensitivity }." },
        { status: 400 }
      );
    }

    const baselineId = typeof body.baselineId === "string" ? body.baselineId.trim() : "";
    const sensitivity = typeof body.sensitivity === "number" ? body.sensitivity : 0;

    if (!baselineId || sensitivity < 1 || sensitivity > 3) {
      return NextResponse.json(
        { error: "baselineId (string) and sensitivity (1, 2, or 3) are required." },
        { status: 400 }
      );
    }

    // Verify the baseline belongs to this agent
    if (!baselineId.startsWith(`${agentId}:`)) {
      return NextResponse.json(
        { error: "Baseline does not belong to this agent." },
        { status: 403 }
      );
    }

    return withSidecarMutateFallback(
      "/activity/baselines",
      "PATCH",
      { agentId, baselineId, sensitivity },
      () => {
        const db = getDb();
        const updated = baselineRepo.setSensitivity(db, baselineId, sensitivity);
        return { updated, baselineId, sensitivity: Math.max(1, Math.min(3, Math.round(sensitivity))) };
      }
    );
  } catch (err) {
    return handleApiError(err, "activity/baselines PATCH", "Failed to update sensitivity.");
  }
}
