/**
 * DELETE /api/workspace/knowledge/source
 *
 * Removes a knowledge source and all its FTS5 chunks.
 * Proxies to sidecar /knowledge/source DELETE when configured; falls back
 * to a direct Drizzle + raw-SQL operation otherwise.
 *
 * Body: { agentId: string, sourceId: number }
 */

import { NextResponse } from "next/server";

import { sql } from "drizzle-orm";

import { withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as personasRepo from "@/lib/database/repositories/personasRepo";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      agentId?: unknown;
      sourceId?: unknown;
    };

    const validation = validateAgentId(
      typeof body.agentId === "string" ? body.agentId : null
    );
    if (!validation.ok) return validation.error;

    const id = Number(body.sourceId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid sourceId: must be a positive integer" },
        { status: 400 }
      );
    }

    return withSidecarMutateFallback(
      "/knowledge/source",
      "DELETE",
      { agentId: validation.agentId, sourceId: id },
      () => {
        const db = getDb();
        // Delete FTS5 chunks first (virtual table — no FK cascade)
        db.run(sql`DELETE FROM knowledge_chunks WHERE source_id = ${id}`);
        // Delete the source record
        personasRepo.removeKnowledgeSource(db, id);
        return { ok: true };
      }
    );
  } catch (err) {
    return handleApiError(err, "knowledge/source DELETE");
  }
}
