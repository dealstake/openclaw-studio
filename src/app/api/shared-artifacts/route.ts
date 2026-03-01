import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as sharedArtifactsRepo from "@/lib/database/repositories/sharedArtifactsRepo";
import { isValidMimeType } from "@/features/shared-artifacts/lib/types";

export const runtime = "nodejs";

const MAX_CONTENT_BYTES = 1_048_576; // 1 MB

// ─── GET /api/shared-artifacts ────────────────────────────────────────────────
// Query params:
//   sourceAgentId?   — filter by agent
//   sourceSessionKey? — filter by session
//   mimeType?        — filter by MIME type
//   name?            — substring search on name
//   limit?           — max items (default 50, max 200)
//   offset?          — pagination offset (default 0)

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const sourceAgentId = params.get("sourceAgentId")?.trim() || null;
    const sourceSessionKey = params.get("sourceSessionKey")?.trim() || null;
    const mimeType = params.get("mimeType")?.trim() || null;
    const nameSearch = params.get("name")?.trim() || null;
    const limit = Math.min(parseInt(params.get("limit") ?? "50", 10) || 50, 200);
    const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

    const db = getDb();
    const result = sharedArtifactsRepo.list(db, {
      sourceAgentId,
      sourceSessionKey,
      mimeType,
      nameSearch,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "shared-artifacts");
  }
}

// ─── POST /api/shared-artifacts ───────────────────────────────────────────────
// Body: CreateSharedArtifactRequest
//   sourceAgentId    — required
//   sourceSessionKey — required
//   name             — required
//   mimeType         — required (must be a supported MIME type)
//   content          — required (max 1 MB)
//   metadata?        — optional JSON object

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }

    const {
      sourceAgentId,
      sourceSessionKey,
      name,
      mimeType,
      content,
      metadata,
    } = body as Record<string, unknown>;

    // Required field validation
    if (!sourceAgentId || typeof sourceAgentId !== "string" || !sourceAgentId.trim()) {
      return NextResponse.json({ error: "sourceAgentId is required." }, { status: 400 });
    }
    if (!sourceSessionKey || typeof sourceSessionKey !== "string" || !sourceSessionKey.trim()) {
      return NextResponse.json({ error: "sourceSessionKey is required." }, { status: 400 });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required." }, { status: 400 });
    }
    if (!isValidMimeType(mimeType)) {
      return NextResponse.json(
        {
          error: `mimeType must be one of: text/plain, text/markdown, application/json, text/html, text/csv, application/octet-stream`,
        },
        { status: 400 },
      );
    }
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content is required and must be a string." }, { status: 400 });
    }
    if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
      return NextResponse.json({ error: "content exceeds 1 MB limit." }, { status: 413 });
    }

    // Serialize metadata
    let metadataJson = "{}";
    if (metadata !== undefined && metadata !== null) {
      if (typeof metadata !== "object" || Array.isArray(metadata)) {
        return NextResponse.json({ error: "metadata must be a JSON object." }, { status: 400 });
      }
      metadataJson = JSON.stringify(metadata);
    }

    const db = getDb();
    const artifact = sharedArtifactsRepo.create(db, {
      id: randomUUID(),
      sourceAgentId: sourceAgentId.trim(),
      sourceSessionKey: sourceSessionKey.trim(),
      name: name.trim(),
      mimeType,
      content,
      metadataJson,
    });

    return NextResponse.json({ artifact }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "shared-artifacts");
  }
}
