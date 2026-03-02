import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import { activityEvents } from "@/lib/database/schema";
import { desc, and, gte, eq, sql } from "drizzle-orm";
import {
  extractToolInvocations,
  aggregateToolMetrics,
  type ToolMetric,
} from "@/features/usage/lib/toolMetrics";

export const runtime = "nodejs";

/**
 * GET /api/usage/tools?days=7&limit=500&agentId=<optional>
 *
 * Returns aggregated tool-level performance metrics extracted from
 * activity event transcripts.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const agentId = url.searchParams.get("agentId")?.trim() || null;
    const days = Math.min(parseInt(url.searchParams.get("days") ?? "7", 10) || 7, 90);
    const eventLimit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "500", 10) || 500,
      2000,
    );

    const result = computeToolMetrics(days, eventLimit, agentId);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "usage/tools GET", "Failed to compute tool metrics.");
  }
}

function computeToolMetrics(
  days: number,
  eventLimit: number,
  agentId: string | null,
): { metrics: ToolMetric[]; eventsAnalyzed: number } {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  // Build conditions
  const conditions = [
    gte(activityEvents.timestamp, cutoff),
    sql`${activityEvents.transcriptJson} IS NOT NULL AND ${activityEvents.transcriptJson} != ''`,
  ];
  if (agentId) conditions.push(eq(activityEvents.agentId, agentId));

  // Fetch activity events that have transcripts
  const rows = db
    .select({
      transcriptJson: activityEvents.transcriptJson,
      timestamp: activityEvents.timestamp,
    })
    .from(activityEvents)
    .where(and(...conditions))
    .orderBy(desc(activityEvents.timestamp))
    .limit(eventLimit)
    .all();

  // Extract all tool invocations from transcripts
  const allInvocations = rows.flatMap((row) =>
    extractToolInvocations(row.transcriptJson!),
  );

  const metrics = aggregateToolMetrics(allInvocations, { trendDays: days });

  return { metrics, eventsAnalyzed: rows.length };
}
