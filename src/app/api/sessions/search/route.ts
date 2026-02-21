import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { resolveAgentWorkspace } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * GET /api/sessions/search?agentId=<id>&query=<text>&limit=50
 *
 * Full-text search across session transcripts.
 * Uses sidecar when configured, falls back to local JSONL grep.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim() ?? "";
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query parameter: query" },
        { status: 400 },
      );
    }

    if (isSidecarConfigured()) {
      const resp = await sidecarGet("/sessions/search", {
        agentId,
        query,
        limit: String(limit),
      });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    // Local fallback: search through JSONL files
    const results = await searchTranscriptsLocal(agentId, query, limit);
    return NextResponse.json({ results, query });
  } catch (err) {
    return handleApiError(err, "sessions/search", "Failed to search transcripts.");
  }
}

type SearchMatch = {
  role: string;
  timestamp: string | null;
  snippet: string;
};

type SearchResult = {
  sessionId: string;
  sessionKey: string | null;
  archived: boolean;
  startedAt: string | null;
  updatedAt: string | null;
  matches: SearchMatch[];
};

async function searchTranscriptsLocal(
  agentId: string,
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const workspace = resolveAgentWorkspace(agentId);
  const sessionsDir = path.join(workspace, "sessions");
  const archiveDir = path.join(sessionsDir, "archive");
  const queryLower = query.toLowerCase();
  const results: SearchResult[] = [];

  // Load sessions.json for key lookups
  let sessionsMap: Record<string, { sessionId?: string }> = {};
  const sessionsJsonPath = path.join(sessionsDir, "sessions.json");
  try {
    if (fs.existsSync(sessionsJsonPath)) {
      sessionsMap = JSON.parse(fs.readFileSync(sessionsJsonPath, "utf-8"));
    }
  } catch {
    // Continue without
  }
  const uuidToKey: Record<string, string> = {};
  for (const [key, val] of Object.entries(sessionsMap)) {
    if (val?.sessionId) uuidToKey[val.sessionId] = key;
  }

  const searchFile = async (filePath: string, sessionId: string, archived: boolean) => {
    const matches: SearchMatch[] = [];

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== "message" || !entry.message) continue;

        const content = typeof entry.message.content === "string"
          ? entry.message.content
          : Array.isArray(entry.message.content)
            ? entry.message.content
                .filter((p: { type: string; text?: string }) => p.type === "text" && p.text)
                .map((p: { text: string }) => p.text)
                .join(" ")
            : "";

        if (content.toLowerCase().includes(queryLower)) {
          // Extract snippet around match
          const idx = content.toLowerCase().indexOf(queryLower);
          const start = Math.max(0, idx - 50);
          const end = Math.min(content.length, idx + query.length + 50);
          matches.push({
            role: entry.message.role ?? "unknown",
            timestamp: entry.timestamp ?? null,
            snippet: (start > 0 ? "..." : "") + content.slice(start, end) + (end < content.length ? "..." : ""),
          });
        }
      } catch {
        // Skip malformed lines
      }
    }

    if (matches.length > 0) {
      const stat = fs.statSync(filePath);
      results.push({
        sessionId,
        sessionKey: uuidToKey[sessionId] ?? null,
        archived,
        startedAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
        matches,
      });
    }
  };

  const collectFiles = (dir: string, archived: boolean): Array<{ path: string; id: string; archived: boolean }> => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith(".jsonl"))
      .map(f => ({ path: path.join(dir, f), id: f.replace(".jsonl", ""), archived }));
  };

  const files = [
    ...collectFiles(sessionsDir, false),
    ...collectFiles(archiveDir, true),
  ];

  // Search files sequentially to avoid opening too many file handles
  for (const file of files) {
    if (results.length >= limit) break;
    await searchFile(file.path, file.id, file.archived);
  }

  return results;
}
