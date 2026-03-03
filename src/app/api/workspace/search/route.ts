import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { listWorkspaceDir, readWorkspaceFile } from "@/lib/workspace/resolve";

export const runtime = "nodejs";

export type MemorySearchResult = {
  filePath: string;
  lineNumber: number;
  snippet: string;
  matchCount: number;
};

export type MemorySearchResponse = {
  results: MemorySearchResult[];
  totalMatches: number;
  filesSearched: number;
};

/**
 * POST /api/workspace/search
 * Body: { agentId: string, query: string }
 *
 * Case-insensitive substring search across MEMORY.md + all memory/*.md files.
 * Returns up to 50 results with ~200-char context snippets.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { agentId?: string; query?: string };

    const validation = validateAgentId(body.agentId);
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const query = (body.query ?? "").trim().toLowerCase();
    if (!query) {
      return NextResponse.json<MemorySearchResponse>({
        results: [],
        totalMatches: 0,
        filesSearched: 0,
      });
    }

    // Build file list: MEMORY.md + all *.md files in memory/
    const filesToSearch: string[] = [];

    // Always try to include MEMORY.md
    filesToSearch.push("MEMORY.md");

    // List memory/ directory (may not exist — that's fine)
    try {
      const { entries } = listWorkspaceDir(agentId, "memory");
      for (const entry of entries) {
        if (entry.type === "file" && entry.name.endsWith(".md")) {
          filesToSearch.push(`memory/${entry.name}`);
        }
      }
    } catch {
      // memory dir may not exist — continue with MEMORY.md only
    }

    const results: MemorySearchResult[] = [];
    let totalMatches = 0;
    let filesSearched = 0;

    for (const filePath of filesToSearch) {
      try {
        const { content } = readWorkspaceFile(agentId, filePath);
        if (!content) continue;
        // Skip files larger than 1MB to prevent OOM on pathological inputs
        if (content.length > 1_048_576) continue;

        filesSearched++;
        const lines = content.split("\n");
        let fileMatchCount = 0;

        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].toLowerCase().includes(query)) continue;

          fileMatchCount++;
          totalMatches++;

          // Cap at 50 total results
          if (results.length < 50) {
            const start = Math.max(0, i - 1);
            const end = Math.min(lines.length, i + 2);
            const snippet = lines.slice(start, end).join("\n").slice(0, 200);
            results.push({
              filePath,
              lineNumber: i + 1,
              snippet,
              matchCount: 0, // filled in below after scanning whole file
            });
          }
        }

        // Back-fill matchCount for all results from this file
        for (const r of results) {
          if (r.filePath === filePath && r.matchCount === 0 && fileMatchCount > 0) {
            r.matchCount = fileMatchCount;
          }
        }
      } catch {
        // File read error (e.g. MEMORY.md doesn't exist) — skip silently
      }
    }

    return NextResponse.json<MemorySearchResponse>({
      results,
      totalMatches,
      filesSearched,
    });
  } catch (err) {
    return handleApiError(err, "workspace/search", "Failed to search workspace.");
  }
}
