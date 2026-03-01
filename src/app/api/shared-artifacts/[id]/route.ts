import { NextResponse, type NextRequest } from "next/server";

import { handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as sharedArtifactsRepo from "@/lib/database/repositories/sharedArtifactsRepo";

export const runtime = "nodejs";

// ─── GET /api/shared-artifacts/:id ───────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "Artifact ID is required." }, { status: 400 });
    }

    const db = getDb();
    const artifact = sharedArtifactsRepo.getById(db, id.trim());

    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }

    return NextResponse.json({ artifact });
  } catch (err) {
    return handleApiError(err, "shared-artifacts/[id]");
  }
}

// ─── DELETE /api/shared-artifacts/:id ────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "Artifact ID is required." }, { status: 400 });
    }

    const db = getDb();
    const deleted = sharedArtifactsRepo.remove(db, id.trim());

    if (!deleted) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "shared-artifacts/[id]");
  }
}
