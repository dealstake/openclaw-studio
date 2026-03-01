/**
 * GET /api/workspace/knowledge/search
 *
 * Full-text search over a persona's indexed knowledge using FTS5 BM25 ranking.
 * Proxies to sidecar /knowledge/search when configured (includes FTS5 snippets);
 * falls back to local raw-SQL search otherwise.
 *
 * Query params:
 *   agentId   — required
 *   personaId — required
 *   q         — required, search query string (max 500 chars)
 *   limit     — optional, max results to return (default 5, max 20)
 *
 * Response:
 *   { results: KnowledgeResult[], query: string }
 *
 * Each KnowledgeResult:
 *   { rowid, sourceId, chunkIndex, content, rank, snippet, sourceType }
 */

import { NextResponse } from "next/server";

import { withSidecarGetFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { localSearch } from "@/features/personas/lib/knowledgeSearch";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;

    const personaId = url.searchParams.get("personaId");
    if (!personaId) {
      return NextResponse.json(
        { error: "Missing required param: personaId" },
        { status: 400 }
      );
    }

    const rawQ = (url.searchParams.get("q") ?? "").trim().slice(0, 500);
    if (!rawQ) {
      return NextResponse.json(
        { error: "Missing required param: q (search query)" },
        { status: 400 }
      );
    }

    const rawLimit = parseInt(url.searchParams.get("limit") ?? "5", 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 5, 1), 20);

    return withSidecarGetFallback(
      "/knowledge/search",
      { agentId: validation.agentId, personaId, q: rawQ, limit: String(limit) },
      () => {
        const results = localSearch(personaId, rawQ, limit);
        return { results, query: rawQ };
      }
    );
  } catch (err) {
    return handleApiError(err, "knowledge/search GET");
  }
}
