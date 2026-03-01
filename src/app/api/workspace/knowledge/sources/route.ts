/**
 * GET /api/workspace/knowledge/sources
 *
 * Returns knowledge sources for a persona, including chunk counts.
 * Proxies to sidecar /knowledge/sources when configured; falls back to
 * a direct Drizzle query (without chunk counts) otherwise.
 *
 * Query params:
 *   agentId   — required
 *   personaId — required
 */

import { NextResponse } from "next/server";

import { withSidecarGetFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as personasRepo from "@/lib/database/repositories/personasRepo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;

    const personaId = url.searchParams.get("personaId");
    if (!personaId) {
      return NextResponse.json(
        { error: "Missing required param: personaId" },
        { status: 400 }
      );
    }

    return withSidecarGetFallback(
      "/knowledge/sources",
      { agentId: validation.agentId, personaId },
      () => {
        const db = getDb();
        const sources = personasRepo.listKnowledgeSources(db, personaId);
        // Local fallback: chunkCount not available (no FTS5 count without sidecar)
        return {
          sources: sources.map((s) => ({
            id: s.id,
            personaId: s.personaId,
            sourceType: s.sourceType,
            sourceUri: s.sourceUri,
            title: s.title,
            fetchedAt: s.fetchedAt,
            chunkCount: undefined,
          })),
        };
      }
    );
  } catch (err) {
    return handleApiError(err, "knowledge/sources GET");
  }
}
