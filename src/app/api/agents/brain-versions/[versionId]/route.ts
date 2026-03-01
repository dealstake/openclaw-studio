import { NextResponse, type NextRequest } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as brainVersionsRepo from "@/lib/database/repositories/brainVersionsRepo";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ versionId: string }> };

// ─── GET /api/agents/brain-versions/[versionId]?agentId=<id> ─────────────────
// Get a single version with full file contents

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { versionId } = await context.params;
    if (!versionId) {
      return NextResponse.json({ error: "versionId is required." }, { status: 400 });
    }

    const validation = validateAgentId(request.nextUrl.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const db = getDb();
    const version = brainVersionsRepo.getById(db, agentId, versionId);

    if (!version) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    return NextResponse.json({ version });
  } catch (err) {
    return handleApiError(err, "brain-versions");
  }
}

// ─── PATCH /api/agents/brain-versions/[versionId] — Update label/description ──

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { versionId } = await context.params;
    if (!versionId) {
      return NextResponse.json({ error: "versionId is required." }, { status: 400 });
    }

    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { agentId: rawAgentId, label, description } = body as {
      agentId?: string;
      label?: string;
      description?: string;
    };

    const validation = validateAgentId(rawAgentId);
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const db = getDb();
    const updated = brainVersionsRepo.update(db, agentId, versionId, {
      label: typeof label === "string" ? label : undefined,
      description: typeof description === "string" ? description : undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "brain-versions");
  }
}

// ─── DELETE /api/agents/brain-versions/[versionId] ───────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { versionId } = await context.params;
    if (!versionId) {
      return NextResponse.json({ error: "versionId is required." }, { status: 400 });
    }

    const validation = validateAgentId(request.nextUrl.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const db = getDb();
    const result = brainVersionsRepo.remove(db, agentId, versionId);

    if (!result.deleted) {
      if (result.reason === "active_version") {
        return NextResponse.json(
          { error: "Cannot delete the currently active version. Deploy another version first." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "brain-versions");
  }
}
