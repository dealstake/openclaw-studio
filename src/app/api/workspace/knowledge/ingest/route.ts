/**
 * POST /api/workspace/knowledge/ingest
 *
 * Parses, chunks, and indexes content into the persona knowledge FTS5 index.
 * Calls knowledgeService (server-side) which handles chunking and sidecar routing.
 *
 * Body (discriminated by `type`):
 *
 *   { agentId, personaId, type: "text",         text: string,     title: string }
 *   { agentId, personaId, type: "file",         filePath: string, sourceType?: string }
 *   { agentId, personaId, type: "url",          url: string,      title?: string }
 *   { agentId, personaId, type: "knowledge_dir" }
 *
 * Response:
 *   text | file | url  → { ok: true, sourceId: number, chunkCount: number }
 *   knowledge_dir      → { indexed: number, failed: string[] }
 */

import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import * as knowledgeService from "@/features/personas/lib/knowledgeService";

export const runtime = "nodejs";

// ─── Type guard helpers ───────────────────────────────────────────────────────

const INGEST_TYPES = ["text", "file", "url", "knowledge_dir"] as const;
type IngestType = (typeof INGEST_TYPES)[number];

function isIngestType(s: unknown): s is IngestType {
  return typeof s === "string" && (INGEST_TYPES as readonly string[]).includes(s);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const validation = validateAgentId(
      typeof body.agentId === "string" ? body.agentId : null
    );
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const personaId = body.personaId;
    if (typeof personaId !== "string" || !personaId.trim()) {
      return NextResponse.json(
        { error: "Missing required field: personaId" },
        { status: 400 }
      );
    }

    const type = body.type;
    if (!isIngestType(type)) {
      return NextResponse.json(
        {
          error: `Invalid type: "${String(type)}". Expected one of: ${INGEST_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    switch (type) {
      case "text": {
        const text = body.text;
        const title = body.title ?? "Untitled";
        if (typeof text !== "string" || !text.trim()) {
          return NextResponse.json(
            { error: "Missing required field: text" },
            { status: 400 }
          );
        }
        const result = await knowledgeService.ingestText(
          agentId,
          personaId,
          text,
          typeof title === "string" ? title : "Untitled"
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "file": {
        const filePath = body.filePath;
        if (typeof filePath !== "string" || !filePath.trim()) {
          return NextResponse.json(
            { error: "Missing required field: filePath" },
            { status: 400 }
          );
        }
        const sourceType =
          typeof body.sourceType === "string" ? body.sourceType : "file";
        const result = await knowledgeService.ingestFile(
          agentId,
          personaId,
          filePath,
          sourceType
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "url": {
        const url = body.url;
        if (typeof url !== "string" || !url.trim()) {
          return NextResponse.json(
            { error: "Missing required field: url" },
            { status: 400 }
          );
        }
        const title =
          typeof body.title === "string" ? body.title : undefined;
        const result = await knowledgeService.ingestUrl(
          agentId,
          personaId,
          url,
          title
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "knowledge_dir": {
        const result = await knowledgeService.indexKnowledgeDir(
          agentId,
          personaId
        );
        return NextResponse.json(result);
      }
    }
  } catch (err) {
    return handleApiError(err, "knowledge/ingest POST");
  }
}
