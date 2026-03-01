/**
 * POST /api/workspace/knowledge/refresh
 *
 * Re-indexes all non-manual knowledge sources for a persona:
 *   - "file" and "knowledge_dir" sources: re-read from disk
 *   - "web" sources: re-fetched from the remote URL
 *   - "manual" sources: skipped (no persistent source to re-fetch)
 *
 * Body: { agentId: string, personaId: string }
 *
 * Response:
 *   { refreshed: number, failed: string[] }
 */

import { NextResponse } from "next/server";

import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import * as knowledgeService from "@/features/personas/lib/knowledgeService";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const validation = validateAgentId(
      typeof body.agentId === "string" ? body.agentId : null,
    );
    if (!validation.ok) return validation.error;

    const personaId = body.personaId;
    if (typeof personaId !== "string" || !personaId.trim()) {
      return NextResponse.json(
        { error: "Missing required field: personaId" },
        { status: 400 },
      );
    }

    const result = await knowledgeService.refreshIndex(
      validation.agentId,
      personaId,
    );

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "knowledge/refresh POST");
  }
}
