import fs from "node:fs/promises";

import { NextResponse } from "next/server";

import { parseAndFilterJsonlEvents } from "@/lib/activity/parseJsonlEvents";
import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as activityRepo from "@/lib/database/repositories/activityRepo";
import { resolveWorkspacePath } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * GET /api/activity?agentId=<id>&limit=50&offset=0&type=<filter>&taskId=<id>&projectSlug=<slug>
 *
 * Read activity events from the database.
 * Falls back to JSONL file parsing via sidecar when running on Cloud Run.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;
    const typeFilter = url.searchParams.get("type")?.trim() || null;
    const taskIdFilter = url.searchParams.get("taskId")?.trim() || null;
    const projectSlugFilter = url.searchParams.get("projectSlug")?.trim() || null;
    const statusFilter = url.searchParams.get("status")?.trim() || null;
    const includeTranscript = url.searchParams.get("include")?.includes("transcript") ?? false;

    // ─── Sidecar path (Cloud Run) — JSONL file-based ──────────────────
    if (isSidecarConfigured()) {
      const resp = await sidecarGet("/file", { agentId, path: "reports/activity.jsonl" });
      if (!resp.ok) {
        return NextResponse.json({ events: [], total: 0 });
      }
      const data = (await resp.json()) as { content?: string };
      return NextResponse.json(
        parseAndFilterJsonlEvents(data.content ?? "", {
          type: typeFilter,
          taskId: taskIdFilter,
          projectSlug: projectSlugFilter,
          status: statusFilter,
          limit,
          offset,
        }),
      );
    }

    // ─── Database path (local) ────────────────────────────────────────
    const db = getDb();
    const result = activityRepo.query(db, {
      type: typeFilter,
      taskId: taskIdFilter,
      projectSlug: projectSlugFilter,
      status: statusFilter,
      includeTranscript,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "activity GET", "Failed to read activity log.");
  }
}

/**
 * POST /api/activity — Insert a new activity event.
 *
 * Body: ActivityEvent JSON object.
 * Writes to both DB and JSONL (backward compatibility).
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const body = await request.json();

    // Validate required fields
    if (!body.id || !body.timestamp || !body.status) {
      return NextResponse.json(
        { error: "Missing required fields: id, timestamp, status" },
        { status: 400 },
      );
    }

    const event = {
      id: body.id as string,
      timestamp: body.timestamp as string,
      type: (body.type as string) ?? "unknown",
      taskName: (body.taskName as string) ?? "",
      taskId: (body.taskId as string) ?? "",
      projectSlug: (body.projectSlug as string | null) ?? null,
      projectName: (body.projectName as string | null) ?? null,
      status: body.status as "success" | "error" | "partial",
      summary: (body.summary as string) ?? "",
      meta: (body.meta as Record<string, unknown>) ?? {},
      // Enriched fields (optional)
      sessionKey: (body.sessionKey as string | null) ?? null,
      transcriptJson: typeof body.transcript === "object" ? JSON.stringify(body.transcript) : (body.transcriptJson as string | null) ?? null,
      tokensIn: typeof body.tokensIn === "number" ? body.tokensIn : null,
      tokensOut: typeof body.tokensOut === "number" ? body.tokensOut : null,
      model: (body.model as string | null) ?? null,
      agentId: (body.agentId as string | null) ?? null,
    };

    // Always write to DB (both local and sidecar modes)
    try {
      const db = getDb();
      activityRepo.insert(db, event);
    } catch {
      // DB write failure in sidecar mode is non-fatal — JSONL is the primary store there
      if (!isSidecarConfigured()) throw new Error("DB write failed");
    }

    // Also append to JSONL for backward compat
    try {
      const { absolute } = resolveWorkspacePath(agentId, "reports/activity.jsonl");
      await fs.appendFile(absolute, JSON.stringify(body) + "\n", "utf-8");
    } catch {
      // JSONL write failure is non-fatal during transition
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "activity POST", "Failed to insert activity event.");
  }
}
