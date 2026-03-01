/**
 * GET /api/workspace/interactions
 *
 * Fetch paginated interaction history for a contact.
 *
 * Query params:
 *   agentId   — required
 *   contactId — required
 *   limit     — optional; default 50, max 200
 *   offset    — optional; default 0
 *
 * Cloud Run (sidecar mode): proxies to Mac Mini's DB-backed endpoint.
 * Local mode: Drizzle query against local studio.db.
 */

import { withSidecarGetFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/database";
import * as contactsRepo from "@/lib/database/repositories/contactsRepo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const contactId = url.searchParams.get("contactId");
    if (!contactId?.trim()) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const limit  = parseInt(url.searchParams.get("limit")  ?? "50", 10) || 50;
    const offset = parseInt(url.searchParams.get("offset") ?? "0",  10) || 0;

    const result = await withSidecarGetFallback(
      "/workspace/interactions",
      { agentId, contactId, limit: String(limit), offset: String(offset) },
      () => {
        const db = getDb();
        return contactsRepo.getInteractionHistory(db, agentId, contactId, limit, offset);
      },
    );

    result.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return result;
  } catch (err) {
    return handleApiError(err, "workspace/interactions GET");
  }
}
