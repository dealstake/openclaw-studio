/**
 * GET /api/workspace/contacts
 *
 * List contacts for an agent with optional persona/stage/tag/search filters
 * and cursor-style pagination.
 *
 * Query params:
 *   agentId   — required
 *   personaId — optional; filter to a specific persona
 *   stage     — optional; filter by pipeline stage
 *   tag       — optional; filter by tag (exact element match)
 *   q         — optional; full-text search (FTS5)
 *   limit     — optional; default 50, max 200
 *   offset    — optional; default 0
 *
 * Cloud Run (sidecar mode): proxies to Mac Mini's DB-backed endpoint.
 * Local mode: Drizzle query against local studio.db.
 */

import { withSidecarGetFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as contactsRepo from "@/lib/database/repositories/contactsRepo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const personaId = url.searchParams.get("personaId") ?? undefined;
    const stage     = url.searchParams.get("stage") ?? undefined;
    const tag       = url.searchParams.get("tag") ?? undefined;
    const q         = url.searchParams.get("q") ?? undefined;
    const limit     = parseInt(url.searchParams.get("limit") ?? "50", 10) || 50;
    const offset    = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

    const sidecarParams: Record<string, string> = { agentId };
    if (personaId) sidecarParams.personaId = personaId;
    if (stage)     sidecarParams.stage     = stage;
    if (tag)       sidecarParams.tag       = tag;
    if (q)         sidecarParams.q         = q;
    sidecarParams.limit  = String(limit);
    sidecarParams.offset = String(offset);

    const result = await withSidecarGetFallback(
      "/workspace/contacts",
      sidecarParams,
      () => {
        const db = getDb();

        if (q?.trim()) {
          const contacts = contactsRepo.searchContacts(db, agentId, q.trim(), limit + offset);
          const paginated = contacts.slice(offset, offset + limit);
          return { contacts: paginated, total: contacts.length };
        }

        return contactsRepo.listContacts(db, agentId, { personaId, stage, tag, limit, offset });
      },
    );

    result.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return result;
  } catch (err) {
    return handleApiError(err, "workspace/contacts GET");
  }
}
