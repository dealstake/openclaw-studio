import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as brainVersionsRepo from "@/lib/database/repositories/brainVersionsRepo";
import type { AgentFileName } from "@/lib/agents/agentFiles";
import { AGENT_FILE_NAMES } from "@/lib/agents/agentFiles";

export const runtime = "nodejs";

// ─── GET /api/agents/brain-versions?agentId=<id> ─────────────────────────────
// List all versions for an agent (files omitted — use GET by ID for full data)

export async function GET(request: NextRequest) {
  try {
    const validation = validateAgentId(request.nextUrl.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const db = getDb();
    const versions = brainVersionsRepo.listByAgent(db, agentId);

    return NextResponse.json({ versions });
  } catch (err) {
    return handleApiError(err, "brain-versions");
  }
}

// ─── POST /api/agents/brain-versions — Create a version snapshot ──────────────
// Body: { agentId, label?, description?, files: Record<AgentFileName, string> }

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const {
      agentId: rawAgentId,
      label,
      description,
      files,
    } = body as {
      agentId?: string;
      label?: string;
      description?: string;
      files?: Record<string, string>;
    };

    const validation = validateAgentId(rawAgentId);
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    // Validate files object
    if (!files || typeof files !== "object") {
      return NextResponse.json({ error: "files is required." }, { status: 400 });
    }
    // Ensure all expected agent file names are present
    const missingFiles = AGENT_FILE_NAMES.filter((name) => !(name in files));
    if (missingFiles.length > 0) {
      return NextResponse.json(
        { error: `Missing brain files: ${missingFiles.join(", ")}` },
        { status: 400 }
      );
    }
    // Build typed files map
    const typedFiles = Object.fromEntries(
      AGENT_FILE_NAMES.map((name) => [name, String(files[name] ?? "")])
    ) as Record<AgentFileName, string>;

    const db = getDb();
    const version = brainVersionsRepo.create(db, {
      id: randomUUID(),
      agentId,
      label: typeof label === "string" ? label.trim() : "",
      description: typeof description === "string" ? description.trim() : "",
      files: typedFiles,
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "brain-versions");
  }
}
