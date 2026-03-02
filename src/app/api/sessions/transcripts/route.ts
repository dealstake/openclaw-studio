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
  archiveType?: "reset" | "deleted" | null;
  archivedAt?: string | null;
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

  /** Parse session key and preview from the first few KB of a JSONL transcript */
  const extractMetaFromFile = (filePath: string): { sessionKey: string | null; model: string | null; preview: string | null; startedAt: string | null } => {
    const result = { sessionKey: null as string | null, model: null as string | null, preview: null as string | null, startedAt: null as string | null };
    try {
      const fd = fs.openSync(filePath, "r");
      const buf = Buffer.alloc(4096);
      const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
      fs.closeSync(fd);
      const chunk = buf.toString("utf-8", 0, bytesRead);
      for (const line of chunk.split("\n").filter(Boolean)) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === "session") {
            result.sessionKey = entry.sessionKey || null;
            result.startedAt = entry.timestamp || null;
          }
          if (entry.type === "model_change" && !result.model) {
            result.model = entry.modelId || null;
          }
          if (entry.type === "message" && entry.message?.role === "user" && !result.preview) {
            const content = entry.message.content;
            if (typeof content === "string") {
              result.preview = content.substring(0, 200);
            } else if (Array.isArray(content)) {
              const textPart = content.find((p: { type: string; text?: string }) => p.type === "text");
              if (textPart?.text) result.preview = textPart.text.substring(0, 200);
            }
          }
        } catch { /* skip bad lines */ }
      }
    } catch { /* skip unreadable */ }
    return result;
  };

  /** Parse archived filename: {uuid}.jsonl.{reset|deleted}.{timestamp} */
  const parseArchivedFilename = (f: string): { sessionId: string; archiveType: "reset" | "deleted"; archivedAt: string } | null => {
    const match = f.match(/^([a-f0-9-]+)\.jsonl\.(reset|deleted)\.(.+)$/);
    if (!match) return null;
    return {
      sessionId: match[1],
      archiveType: match[2] as "reset" | "deleted",
      archivedAt: match[3],
    };
  };

  const collectFromDir = (dir: string, dirArchived: boolean) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      let sessionId: string;
      let archiveType: "reset" | "deleted" | null = null;
      let archivedAt: string | null = null;

      if (file.endsWith(".jsonl")) {
        sessionId = file.replace(".jsonl", "");
      } else {
        const parsed = parseArchivedFilename(file);
        if (!parsed) continue;
        sessionId = parsed.sessionId;
        archiveType = parsed.archiveType;
        archivedAt = parsed.archivedAt;
      }

      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        const isArchived = dirArchived || archiveType !== null;

        // For active sessions, use sessions.json lookup; for archived, read from file
        let key = uuidToKey[sessionId] ?? null;
        let model: string | null = key ? (sessionsMap[key] as { model?: string })?.model ?? null : null;
        let preview: string | null = null;
        let startedAt: string | null = stat.birthtime.toISOString();

        if (isArchived || !key) {
          // Extract metadata from file content for archived/orphaned sessions
          const meta = extractMetaFromFile(filePath);
          if (!key && meta.sessionKey) key = meta.sessionKey;
          if (!model && meta.model) model = meta.model;
          if (meta.preview) preview = meta.preview;
          if (meta.startedAt) startedAt = meta.startedAt;
        }

        entries.push({
          sessionId,
          sessionKey: key,
          archived: isArchived,
          archiveType,
          archivedAt,
          size: stat.size,
          startedAt,
          updatedAt: stat.mtime.toISOString(),
          model,
          preview,
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
