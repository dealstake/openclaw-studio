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
      const baselines = baselineRepo.queryBaselines(db, agentId);
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
