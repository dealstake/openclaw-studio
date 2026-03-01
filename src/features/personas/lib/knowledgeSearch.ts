/**
 * Knowledge Search Service — Phase 3
 *
 * Provides FTS5-powered full-text search over indexed persona knowledge.
 * Routes through the workspace sidecar when configured (Cloud Run → Mac Mini);
 * falls back to local raw SQL for development/local deployments.
 *
 * FTS5 query sanitisation: user input is wrapped in double quotes to force
 * phrase-match semantics, preventing operator injection (NEAR/AND/OR/NOT/*).
 *
 * Schema (FTS5 virtual table):
 *   knowledge_chunks(
 *     persona_id UNINDEXED,
 *     source_id  UNINDEXED,
 *     chunk_index UNINDEXED,
 *     content,
 *     tokenize = 'porter unicode61'
 *   )
 */

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/database";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single knowledge chunk returned from an FTS5 search. */
export interface KnowledgeResult {
  /** FTS5 rowid */
  rowid: number;
  /** FK to knowledge_sources.id */
  sourceId: number;
  /** Zero-based position of this chunk within the source */
  chunkIndex: number;
  /** Full chunk text */
  content: string;
  /** BM25 rank (negative — lower is more relevant) */
  rank: number;
  /** Short highlighted snippet for display */
  snippet: string;
  /** Source type tag: "file" | "web" | "manual" | "knowledge_dir" | "unknown" */
  sourceType: string;
}

/** Knowledge result with optional surrounding chunk context. */
export interface KnowledgeResultWithContext extends KnowledgeResult {
  /** The chunk immediately before this one in the same source, if it exists. */
  prevChunk: string | null;
  /** The chunk immediately after this one in the same source, if it exists. */
  nextChunk: string | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Sanitise a user-supplied FTS5 query by wrapping it in double quotes
 * (phrase match). Internal double quotes are escaped as `""`.
 *
 * This prevents FTS5 operator injection (NEAR/AND/OR/NOT/*) from causing
 * SQLite syntax errors or unintended cross-persona search.
 */
function sanitizeFtsQuery(q: string): string {
  return '"' + q.replace(/"/g, '""') + '"';
}

/** Raw FTS5 row shape returned by better-sqlite3 / Drizzle raw SQL. */
interface RawChunkRow {
  rowid: number;
  source_id: number;
  chunk_index: number;
  content: string;
  rank: number;
}

/** Single content row for context fetching. */
interface RawContentRow {
  content: string;
}

/**
 * Local FTS5 search — used when the sidecar is not configured.
 * Does NOT include FTS5 snippet() (requires sidecar path for that).
 *
 * Exported for use in the Next.js API route as the `withSidecarGetFallback`
 * local function, avoiding double sidecar-check indirection.
 */
export function localSearch(
  personaId: string,
  query: string,
  limit: number
): KnowledgeResult[] {
  const db = getDb();
  const sanitized = sanitizeFtsQuery(query);

  try {
    const rows = db.all(
      sql`
        SELECT
          rowid,
          source_id,
          chunk_index,
          content,
          rank
        FROM knowledge_chunks
        WHERE knowledge_chunks MATCH ${sanitized}
          AND persona_id = ${personaId}
        ORDER BY rank
        LIMIT ${limit}
      `
    ) as RawChunkRow[];

    return rows.map((row) => ({
      rowid:      row.rowid,
      sourceId:   row.source_id,
      chunkIndex: row.chunk_index,
      content:    row.content,
      rank:       row.rank,
      // Local fallback: no FTS5 snippet() — use a short content prefix instead
      snippet:    row.content.slice(0, 300),
      sourceType: "unknown",
    }));
  } catch {
    // FTS5 syntax error (malformed query after sanitisation), empty index, etc.
    return [];
  }
}

/**
 * Fetch a single adjacent chunk by source + chunk index. Returns null if not found.
 * Used by `searchWithContext` for the local fallback path.
 */
function fetchAdjacentChunk(sourceId: number, chunkIndex: number): string | null {
  if (chunkIndex < 0) return null;

  const db = getDb();
  try {
    const rows = db.all(
      sql`
        SELECT content
        FROM knowledge_chunks
        WHERE source_id  = ${sourceId}
          AND chunk_index = ${chunkIndex}
        LIMIT 1
      `
    ) as RawContentRow[];
    return rows[0]?.content ?? null;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search indexed knowledge for a persona using FTS5 BM25 ranking.
 *
 * When the sidecar is configured, the query is forwarded to
 * `GET /knowledge/search` on the sidecar, which also returns FTS5 snippets.
 * Otherwise, a local raw-SQL fallback is used.
 *
 * @param agentId   Agent workspace identifier (routes the sidecar request)
 * @param personaId Persona to search within — chunks are scoped to this ID
 * @param query     Natural language search query (max 500 chars, trimmed)
 * @param limit     Max results to return (default 5, clamped 1–20)
 */
export async function search(
  agentId: string,
  personaId: string,
  query: string,
  limit = 5
): Promise<KnowledgeResult[]> {
  const q = query.trim().slice(0, 500);
  if (!q) return [];

  const safeLimit = Math.min(Math.max(limit, 1), 20);

  if (isSidecarConfigured()) {
    const resp = await sidecarGet("/knowledge/search", {
      agentId,
      personaId,
      q,
      limit: String(safeLimit),
    });

    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        err.error ?? `Sidecar /knowledge/search returned ${resp.status}`
      );
    }

    const data = (await resp.json()) as { results: KnowledgeResult[] };
    return data.results ?? [];
  }

  return localSearch(personaId, q, safeLimit);
}

/**
 * Search indexed knowledge and attach surrounding chunk context.
 *
 * Fetches the immediately adjacent chunks (prev/next by `chunkIndex`) from the
 * same source, giving the LLM broader context around each matching snippet.
 * Useful for RAG prompts where a single chunk may lack surrounding information.
 *
 * **Context fetch limitation**: adjacent chunks are always fetched from the
 * local SQLite DB. When the sidecar is configured (Cloud Run), the primary
 * search results come from the sidecar but context chunks fall back to the
 * local DB. If the local DB has no matching chunks (e.g. fresh Cloud Run
 * deployment without a local mirror), prevChunk/nextChunk will be null.
 *
 * @param agentId   Agent workspace identifier
 * @param personaId Persona to search within
 * @param query     Search query
 * @param limit     Max results (default 5, clamped 1–20)
 */
export async function searchWithContext(
  agentId: string,
  personaId: string,
  query: string,
  limit = 5
): Promise<KnowledgeResultWithContext[]> {
  const results = await search(agentId, personaId, query, limit);
  if (results.length === 0) return [];

  return results.map((result) => ({
    ...result,
    prevChunk: fetchAdjacentChunk(result.sourceId, result.chunkIndex - 1),
    nextChunk: fetchAdjacentChunk(result.sourceId, result.chunkIndex + 1),
  }));
}
