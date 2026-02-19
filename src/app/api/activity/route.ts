import fs from "node:fs/promises";

import { NextResponse } from "next/server";

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

    // ─── Sidecar path (Cloud Run) — still file-based ──────────────────
    if (isSidecarConfigured()) {
      return handleSidecarFallback(agentId, { limit, offset, typeFilter, taskIdFilter, projectSlugFilter, statusFilter });
    }

    // ─── Database path (local) ────────────────────────────────────────
    const db = getDb();
    let result = activityRepo.query(db, {
      type: typeFilter,
      taskId: taskIdFilter,
      projectSlug: projectSlugFilter,
      status: statusFilter,
      limit,
      offset,
    });

    // Auto-import from activity.jsonl if DB is empty (first access after migration)
    if (result.total === 0 && !typeFilter && !taskIdFilter && !projectSlugFilter && !statusFilter) {
      try {
        const { absolute } = resolveWorkspacePath(agentId, "reports/activity.jsonl");
        const content = await fs.readFile(absolute, "utf-8");
        if (content.trim()) {
          activityRepo.importFromJsonl(db, content);
          result = activityRepo.query(db, {
            type: typeFilter,
            taskId: taskIdFilter,
            projectSlug: projectSlugFilter,
            status: statusFilter,
            limit,
            offset,
          });
        }
      } catch {
        // JSONL file missing or unreadable — not fatal
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "activity GET", "Failed to read activity log.");
  }
}

/**
 * POST /api/activity — Insert a new activity event.
 *
 * Body: ActivityEvent JSON object.
 * Also appends to activity.jsonl for backward compatibility.
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
    };

    if (!isSidecarConfigured()) {
      const db = getDb();
      activityRepo.insert(db, event);
    }

    // Dual-write: also append to JSONL for backward compat
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

// ─── Sidecar fallback (unchanged file-based logic) ────────────────────────

async function handleSidecarFallback(
  agentId: string,
  filters: {
    limit: number;
    offset: number;
    typeFilter: string | null;
    taskIdFilter: string | null;
    projectSlugFilter: string | null;
    statusFilter: string | null;
  },
) {
  const resp = await sidecarGet("/file", { agentId, path: "reports/activity.jsonl" });
  if (!resp.ok) {
    return NextResponse.json({ events: [], total: 0 });
  }
  const data = (await resp.json()) as { content?: string };
  const raw = data.content ?? "";

  if (!raw.trim()) {
    return NextResponse.json({ events: [], total: 0 });
  }

  type RawEvent = {
    type?: string;
    taskId?: string;
    projectSlug?: string;
    status?: string;
    timestamp?: string;
  };

  let events: RawEvent[] = [];
  for (const line of raw.split("\n").filter((l) => l.trim())) {
    try {
      events.push(JSON.parse(line) as RawEvent);
    } catch {
      // Skip malformed
    }
  }

  if (filters.typeFilter) events = events.filter((e) => e.type === filters.typeFilter);
  if (filters.taskIdFilter) events = events.filter((e) => e.taskId === filters.taskIdFilter);
  if (filters.projectSlugFilter) events = events.filter((e) => e.projectSlug === filters.projectSlugFilter);
  if (filters.statusFilter) events = events.filter((e) => e.status === filters.statusFilter);

  events.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));

  const total = events.length;
  const paged = events.slice(filters.offset, filters.offset + filters.limit);

  return NextResponse.json({ events: paged, total });
}
