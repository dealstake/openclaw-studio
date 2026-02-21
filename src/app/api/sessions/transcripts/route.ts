import fs from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { resolveAgentWorkspace } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * GET /api/sessions/transcripts?agentId=<id>&page=1&perPage=50
 *
 * List all session transcripts (active + archived JSONL files).
 * Uses sidecar when configured, falls back to local filesystem listing.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    if (isSidecarConfigured()) {
      const page = url.searchParams.get("page") ?? "";
      const perPage = url.searchParams.get("perPage") ?? "";
      const params: Record<string, string> = { agentId };
      if (page) params.page = page;
      if (perPage) params.perPage = perPage;
      const resp = await sidecarGet("/sessions/transcripts", params);
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    // Local fallback: list JSONL files from sessions/ and sessions/archive/
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const perPage = parseInt(url.searchParams.get("perPage") ?? "50", 10);
    const transcripts = listTranscriptsLocal(agentId);

    // Sort by updatedAt descending (newest first)
    transcripts.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });

    const start = (page - 1) * perPage;
    const paged = transcripts.slice(start, start + perPage);

    return NextResponse.json({
      transcripts: paged,
      count: transcripts.length,
      page,
      perPage,
      hasMore: start + perPage < transcripts.length,
    });
  } catch (err) {
    return handleApiError(err, "sessions/transcripts", "Failed to list transcripts.");
  }
}

type TranscriptEntry = {
  sessionId: string;
  sessionKey: string | null;
  archived: boolean;
  size: number;
  startedAt: string | null;
  updatedAt: string | null;
  model: string | null;
  preview: string | null;
};

function listTranscriptsLocal(agentId: string): TranscriptEntry[] {
  const workspace = resolveAgentWorkspace(agentId);
  const sessionsDir = path.join(workspace, "sessions");
  const archiveDir = path.join(sessionsDir, "archive");
  const entries: TranscriptEntry[] = [];

  // Load sessions.json for key lookups
  let sessionsMap: Record<string, { sessionId?: string; model?: string }> = {};
  const sessionsJsonPath = path.join(sessionsDir, "sessions.json");
  try {
    if (fs.existsSync(sessionsJsonPath)) {
      sessionsMap = JSON.parse(fs.readFileSync(sessionsJsonPath, "utf-8"));
    }
  } catch {
    // Continue without session metadata
  }

  // Build reverse map: UUID → session key
  const uuidToKey: Record<string, string> = {};
  for (const [key, val] of Object.entries(sessionsMap)) {
    if (val?.sessionId) uuidToKey[val.sessionId] = key;
  }

  const collectFromDir = (dir: string, archived: boolean) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".jsonl"));
    for (const file of files) {
      const sessionId = file.replace(".jsonl", "");
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        const key = uuidToKey[sessionId] ?? null;
        const meta = key ? sessionsMap[key] : null;
        entries.push({
          sessionId,
          sessionKey: key,
          archived,
          size: stat.size,
          startedAt: stat.birthtime.toISOString(),
          updatedAt: stat.mtime.toISOString(),
          model: meta?.model ?? null,
          preview: null,
        });
      } catch {
        // Skip unreadable files
      }
    }
  };

  collectFromDir(sessionsDir, false);
  collectFromDir(archiveDir, true);

  return entries;
}
