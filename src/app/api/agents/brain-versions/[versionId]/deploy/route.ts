import { NextResponse, type NextRequest } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as brainVersionsRepo from "@/lib/database/repositories/brainVersionsRepo";
import { AGENT_FILE_NAMES, isAgentFileName } from "@/lib/agents/agentFiles";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ versionId: string }> };

/**
 * POST /api/agents/brain-versions/[versionId]/deploy
 *
 * Activates a version as the current agent brain configuration.
 * - Marks the version as isActive in the DB
 * - Returns the full version with files so the client can write them to gateway
 *
 * The client is responsible for calling agents.files.set for each file.
 * This split avoids coupling the API route to WebSocket gateway sessions
 * (the studio API layer is HTTP-only; gateway writes happen client-side).
 *
 * Body: { agentId }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { versionId } = await context.params;
    if (!versionId) {
      return NextResponse.json({ error: "versionId is required." }, { status: 400 });
    }

    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { agentId: rawAgentId } = body as { agentId?: string };

    const validation = validateAgentId(rawAgentId);
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const db = getDb();

    // Verify version exists and belongs to agent
    const existing = brainVersionsRepo.getById(db, agentId, versionId);
    if (!existing) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    // Validate that all expected brain files are present in the snapshot
    const missingFiles = AGENT_FILE_NAMES.filter(
      (name) => !isAgentFileName(name) || !(name in existing.files)
    );
    if (missingFiles.length > 0) {
      return NextResponse.json(
        { error: `Version is missing brain files: ${missingFiles.join(", ")}` },
        { status: 422 }
      );
    }

    // Mark as active in DB (clears all other active flags for this agent)
    const deployed = brainVersionsRepo.deploy(db, agentId, versionId);
    if (!deployed) {
      return NextResponse.json(
        { error: "Deploy failed — version not found." },
        { status: 404 }
      );
    }

    // Return the full version (with files) so the client can push to gateway
    return NextResponse.json({ version: deployed });
  } catch (err) {
    return handleApiError(err, "brain-versions/deploy");
  }
}
