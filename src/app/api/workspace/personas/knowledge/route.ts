import { NextResponse } from "next/server";
import { withSidecarGetFallback, withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as personasRepo from "@/lib/database/repositories/personasRepo";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_SOURCE_TYPES = ["web", "file", "manual"] as const;
type SourceType = (typeof VALID_SOURCE_TYPES)[number];

function isValidSourceType(s: string): s is SourceType {
  return (VALID_SOURCE_TYPES as readonly string[]).includes(s);
}

// ---------------------------------------------------------------------------
// GET /api/workspace/personas/knowledge?agentId=<id>&personaId=<id>
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;

    const personaId = url.searchParams.get("personaId");
    if (!personaId) {
      return NextResponse.json({ error: "Missing required param: personaId" }, { status: 400 });
    }

    const sidecarParams = {
      agentId: validation.agentId,
      personaId,
    };

    return withSidecarGetFallback(
      "/workspace/personas/knowledge",
      sidecarParams,
      () => {
        const db = getDb();
        const sources = personasRepo.listKnowledgeSources(db, personaId);
        return { sources };
      },
    );
  } catch (err) {
    return handleApiError(err, "knowledge-get");
  }
}

// ---------------------------------------------------------------------------
// POST /api/workspace/personas/knowledge — Add a knowledge source
// Body: { agentId, personaId, sourceType, sourceUri, title }
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, personaId, sourceType, sourceUri, title } = body;

    const validation = validateAgentId(agentId);
    if (!validation.ok) return validation.error;

    if (!personaId || typeof personaId !== "string") {
      return NextResponse.json({ error: "Missing required field: personaId" }, { status: 400 });
    }
    if (!sourceType || !isValidSourceType(sourceType)) {
      return NextResponse.json({ error: `Invalid sourceType: ${sourceType}` }, { status: 400 });
    }
    if (!sourceUri || typeof sourceUri !== "string") {
      return NextResponse.json({ error: "Missing required field: sourceUri" }, { status: 400 });
    }

    return withSidecarMutateFallback(
      "/workspace/personas/knowledge",
      "POST",
      body,
      () => {
        const db = getDb();

        // Verify persona exists
        const persona = personasRepo.getById(db, personaId);
        if (!persona) {
          return NextResponse.json({ error: "Persona not found" }, { status: 404 });
        }

        personasRepo.addKnowledgeSource(db, {
          personaId,
          sourceType,
          sourceUri,
          title: title ?? "",
          fetchedAt: new Date().toISOString(),
        });

        return { ok: true };
      },
    );
  } catch (err) {
    return handleApiError(err, "knowledge-post");
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/workspace/personas/knowledge?agentId=<id>&sourceId=<id>
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;

    const sourceId = url.searchParams.get("sourceId");
    if (!sourceId) {
      return NextResponse.json({ error: "Missing required param: sourceId" }, { status: 400 });
    }

    const id = parseInt(sourceId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid sourceId" }, { status: 400 });
    }

    return withSidecarMutateFallback(
      "/workspace/personas/knowledge",
      "DELETE",
      { agentId: validation.agentId, sourceId: id },
      () => {
        const db = getDb();
        personasRepo.removeKnowledgeSource(db, id);
        return { ok: true };
      },
    );
  } catch (err) {
    return handleApiError(err, "knowledge-delete");
  }
}
