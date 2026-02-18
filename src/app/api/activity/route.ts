import fs from "node:fs/promises";

import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { resolveWorkspacePath } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * GET /api/activity?agentId=<id>&limit=50&offset=0&type=<filter>&taskId=<id>&projectSlug=<slug>
 *
 * Read activity events from the agent's reports/activity.jsonl file.
 * Proxies to sidecar when running on Cloud Run.
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

    // ─── Sidecar proxy ────────────────────────────────────────────────
    if (isSidecarConfigured()) {
      const params: Record<string, string> = { agentId, limit: String(limit), offset: String(offset) };
      if (typeFilter) params.type = typeFilter;
      if (taskIdFilter) params.taskId = taskIdFilter;
      if (projectSlugFilter) params.projectSlug = projectSlugFilter;
      if (statusFilter) params.status = statusFilter;
      const resp = await sidecarGet("/activity", params);
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    // ─── Local filesystem ─────────────────────────────────────────────
    const { absolute } = resolveWorkspacePath(agentId, "reports/activity.jsonl");

    let raw: string;
    try {
      raw = await fs.readFile(absolute, "utf-8");
    } catch {
      // File doesn't exist yet — not an error
      return NextResponse.json({ events: [], total: 0 });
    }

    const lines = raw.split("\n").filter((l) => l.trim());

    type RawEvent = {
      type?: string;
      taskId?: string;
      projectSlug?: string;
      status?: string;
      timestamp?: string;
    };

    let events: RawEvent[] = [];
    for (const line of lines) {
      try {
        events.push(JSON.parse(line) as RawEvent);
      } catch {
        // Skip malformed lines
      }
    }

    // Apply filters
    if (typeFilter) {
      events = events.filter((e) => e.type === typeFilter);
    }
    if (taskIdFilter) {
      events = events.filter((e) => e.taskId === taskIdFilter);
    }
    if (projectSlugFilter) {
      events = events.filter((e) => e.projectSlug === projectSlugFilter);
    }
    if (statusFilter) {
      events = events.filter((e) => e.status === statusFilter);
    }

    // Sort reverse chronological
    events.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));

    const total = events.length;
    const paged = events.slice(offset, offset + limit);

    return NextResponse.json({ events: paged, total });
  } catch (err) {
    return handleApiError(err, "activity GET", "Failed to read activity log.");
  }
}
