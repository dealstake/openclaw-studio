/**
 * Knowledge Ingestion Service — Phase 2
 *
 * Server-side utility for indexing persona knowledge into the FTS5 SQLite
 * index. Handles file, URL, and text ingestion, chunking via the shared
 * chunker utility, and FTS5 inserts via the workspace sidecar (with a local
 * Drizzle fallback when the sidecar is not configured).
 *
 * Schema note (Phase 1 actual, differs from original spec):
 *   knowledge_sources: id INTEGER PK, persona_id, source_type,
 *                      source_uri, title, fetched_at
 *   knowledge_chunks (FTS5): persona_id UNINDEXED, source_id UNINDEXED,
 *                             chunk_index UNINDEXED, content
 */

import fs from "fs";
import path from "path";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/database";
import { knowledgeSources } from "@/lib/database/schema";
import * as personasRepo from "@/lib/database/repositories/personasRepo";
import { resolveWorkspacePath } from "@/lib/workspace/resolve";
import { chunkMarkdown, chunkPlainText } from "@/lib/rag/chunker";
import {
  isSidecarConfigured,
  sidecarGet,
  sidecarMutate,
} from "@/lib/workspace/sidecar";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KnowledgeSource {
  id: number;
  personaId: string;
  sourceType: string;
  /** Canonical identifier: "file:<relPath>", "text:<slug>", or a URL */
  sourceUri: string;
  title: string;
  fetchedAt: string;
  /** Populated when returned from sidecar (FTS5 count); undefined locally */
  chunkCount?: number;
}

export interface KnowledgeChunkInput {
  content: string;
  chunkIndex: number;
}

export interface IngestResult {
  sourceId: number;
  chunkCount: number;
}

export interface IndexDirResult {
  indexed: number;
  failed: string[];
}

export interface RefreshResult {
  refreshed: number;
  failed: string[];
}

// ─── SSRF protection ──────────────────────────────────────────────────────────

/**
 * Block requests to private/localhost IP ranges before fetching a URL.
 * Covers 127.0.0.0/8, 10.0.0.0/8, 172.16-31.x.x, 192.168.x.x,
 * 169.254.x.x (link-local / metadata), and IPv6 loopback.
 *
 * Note: this is a hostname-level check only. DNS rebinding is not in scope
 * for the current threat model; full SSRF mitigation would require resolving
 * the hostname and re-checking after DNS resolution.
 */
const PRIVATE_HOST_RE =
  /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|::1)$/i;

function assertSsrfSafe(urlStr: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid URL: ${urlStr}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Disallowed URL scheme: ${parsed.protocol}`);
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    throw new Error(
      `URL blocked: private/localhost hosts are not allowed (${parsed.hostname})`
    );
  }
}

// ─── Internal: FTS5 indexing ─────────────────────────────────────────────────

/**
 * Send chunks to the FTS5 index via the sidecar, or write directly via
 * Drizzle raw SQL when the sidecar is not configured.
 *
 * Replaces any existing chunks for the given sourceId before inserting.
 */
async function indexChunksToFts5(
  agentId: string,
  personaId: string,
  sourceId: number,
  chunks: KnowledgeChunkInput[]
): Promise<void> {
  if (isSidecarConfigured()) {
    const resp = await sidecarMutate("/knowledge/index", "POST", {
      agentId,
      sourceId,
      personaId,
      chunks,
    });
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        err.error ?? `Sidecar /knowledge/index returned ${resp.status}`
      );
    }
    return;
  }

  // Local fallback: Drizzle raw SQL — FTS5 WHERE on UNINDEXED col is a full scan
  const db = getDb();
  db.run(sql`DELETE FROM knowledge_chunks WHERE source_id = ${sourceId}`);
  for (const chunk of chunks) {
    db.run(
      sql`INSERT INTO knowledge_chunks(persona_id, source_id, chunk_index, content)
          VALUES (${personaId}, ${sourceId}, ${chunk.chunkIndex}, ${chunk.content})`
    );
  }
}

// ─── Internal: source record management ──────────────────────────────────────

/**
 * Create or update a knowledge_sources record.
 * Deduplicates by sourceUri — re-ingestion updates fetchedAt.
 *
 * Returns the integer ID of the created/updated record.
 */
function upsertSource(
  personaId: string,
  sourceType: string,
  sourceUri: string,
  title: string
): number {
  const db = getDb();

  const existing = db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.sourceUri, sourceUri))
    .get();

  if (existing) {
    db.update(knowledgeSources)
      .set({ fetchedAt: new Date().toISOString(), title })
      .where(eq(knowledgeSources.id, existing.id))
      .run();
    return existing.id;
  }

  const result = db
    .insert(knowledgeSources)
    .values({
      personaId,
      sourceType,
      sourceUri,
      title,
      fetchedAt: new Date().toISOString(),
    })
    .run();

  return Number(result.lastInsertRowid);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Index pasted/programmatic text content for a persona.
 *
 * @param agentId     Agent workspace identifier (used for sidecar routing)
 * @param personaId   Target persona
 * @param text        Raw text content to index
 * @param title       Human-readable label for this source
 */
export async function ingestText(
  agentId: string,
  personaId: string,
  text: string,
  title: string
): Promise<IngestResult> {
  if (!text.trim()) {
    throw new Error("Cannot index empty text");
  }

  const rawChunks = chunkPlainText(text);
  const chunks: KnowledgeChunkInput[] = rawChunks.map((content, i) => ({
    content,
    chunkIndex: i,
  }));

  // Deterministic URI for text sources (deduplicates on re-paste)
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
  const sourceUri = `text:${slug}:${Buffer.from(text.slice(0, 64)).toString("base64url").slice(0, 16)}`;

  const sourceId = upsertSource(personaId, "manual", sourceUri, title);
  await indexChunksToFts5(agentId, personaId, sourceId, chunks);

  return { sourceId, chunkCount: chunks.length };
}

/**
 * Ingest a file from the agent workspace into the FTS5 index.
 *
 * Security: uses `resolveWorkspacePath` to prevent path traversal.
 *
 * @param agentId          Agent workspace identifier
 * @param personaId        Target persona
 * @param relativeFilePath Path relative to the agent workspace root
 * @param sourceType       Source category tag (default: "file")
 */
export async function ingestFile(
  agentId: string,
  personaId: string,
  relativeFilePath: string,
  sourceType = "file"
): Promise<IngestResult> {
  // Path traversal prevention — throws if path escapes the workspace
  const { absolute } = resolveWorkspacePath(agentId, relativeFilePath);

  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${relativeFilePath}`);
  }

  const stat = fs.statSync(absolute);
  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${relativeFilePath}`);
  }

  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
  if (stat.size > MAX_FILE_BYTES) {
    throw new Error(
      `File exceeds 10 MB limit: ${relativeFilePath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`
    );
  }

  const content = fs.readFileSync(absolute, "utf-8");
  const ext = path.extname(absolute).toLowerCase();

  const rawChunks =
    ext === ".md" ? chunkMarkdown(content) : chunkPlainText(content);
  const chunks: KnowledgeChunkInput[] = rawChunks.map((c, i) => ({
    content: c,
    chunkIndex: i,
  }));

  const title = path.basename(absolute);
  const sourceUri = `file:${relativeFilePath}`;
  const sourceId = upsertSource(personaId, sourceType, sourceUri, title);

  await indexChunksToFts5(agentId, personaId, sourceId, chunks);

  return { sourceId, chunkCount: chunks.length };
}

/**
 * Fetch and index content from a remote URL.
 *
 * Security: SSRF protection blocks private/localhost IPs.
 * Only HTTP and HTTPS schemes are allowed.
 *
 * @param agentId   Agent workspace identifier
 * @param personaId Target persona
 * @param url       Remote URL to fetch
 * @param title     Optional display title (defaults to URL)
 */
export async function ingestUrl(
  agentId: string,
  personaId: string,
  url: string,
  title?: string
): Promise<IngestResult> {
  // SSRF protection — throws on private/localhost hosts
  assertSsrfSafe(url);

  const resp = await fetch(url, {
    headers: { "User-Agent": "OpenClaw-KnowledgeBot/1.0 (+https://openclaw.ai)" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch URL (${resp.status} ${resp.statusText}): ${url}`);
  }

  const text = await resp.text();

  // Minimal HTML → plain-text: strip tags, collapse whitespace
  const contentType = resp.headers.get("content-type") ?? "";
  const stripped = contentType.includes("html")
    ? text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim()
    : text;

  const rawChunks = chunkPlainText(stripped);
  const chunks: KnowledgeChunkInput[] = rawChunks.map((c, i) => ({
    content: c,
    chunkIndex: i,
  }));

  const sourceId = upsertSource(personaId, "web", url, title ?? url);
  await indexChunksToFts5(agentId, personaId, sourceId, chunks);

  return { sourceId, chunkCount: chunks.length };
}

/**
 * Index all markdown and text files in the agent's `knowledge/` directory.
 *
 * Scans `<agentWorkspace>/knowledge/*.{md,txt}` and ingests each file.
 * Silently skips the directory if it doesn't exist.
 *
 * @param agentId   Agent workspace identifier
 * @param personaId Target persona
 */
export async function indexKnowledgeDir(
  agentId: string,
  personaId: string
): Promise<IndexDirResult> {
  let knowledgeDir: string;
  try {
    ({ absolute: knowledgeDir } = resolveWorkspacePath(agentId, "knowledge"));
  } catch {
    return { indexed: 0, failed: [] };
  }

  if (!fs.existsSync(knowledgeDir)) {
    return { indexed: 0, failed: [] };
  }

  const SUPPORTED_EXTS = new Set([".md", ".txt"]);
  const files = fs.readdirSync(knowledgeDir).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return SUPPORTED_EXTS.has(ext) && !f.startsWith(".");
  });

  let indexed = 0;
  const failed: string[] = [];

  for (const file of files) {
    try {
      await ingestFile(
        agentId,
        personaId,
        path.join("knowledge", file),
        "knowledge_dir"
      );
      indexed++;
    } catch (err) {
      failed.push(
        `${file}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { indexed, failed };
}

/**
 * Retrieve the list of indexed knowledge sources for a persona.
 *
 * When the sidecar is configured, chunk counts are included. In the local
 * fallback mode, `chunkCount` is undefined (no FTS5 count without sidecar).
 *
 * @param agentId   Agent workspace identifier
 * @param personaId Target persona
 */
export async function getSourceList(
  agentId: string,
  personaId: string
): Promise<KnowledgeSource[]> {
  if (isSidecarConfigured()) {
    const resp = await sidecarGet("/knowledge/sources", { agentId, personaId });
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        err.error ?? `Sidecar /knowledge/sources returned ${resp.status}`
      );
    }
    const data = (await resp.json()) as { sources: KnowledgeSource[] };
    return data.sources;
  }

  // Local fallback: return sources without chunk counts
  const db = getDb();
  const rows = personasRepo.listKnowledgeSources(db, personaId);
  return rows.map((r) => ({
    id: r.id,
    personaId: r.personaId,
    sourceType: r.sourceType,
    sourceUri: r.sourceUri,
    title: r.title,
    fetchedAt: r.fetchedAt,
    chunkCount: undefined,
  }));
}

/**
 * Delete a knowledge source and all its FTS5 chunks.
 *
 * The sidecar removes both chunks and source record in a single transaction.
 * The local fallback handles them separately via Drizzle + raw SQL.
 *
 * @param agentId   Agent workspace identifier
 * @param personaId Persona the source belongs to (unused in sidecar path,
 *                  kept for API symmetry and future authz)
 * @param sourceId  Integer ID of the knowledge_sources row
 */
export async function deleteSource(
  agentId: string,
  personaId: string,
  sourceId: number
): Promise<void> {
  void personaId; // reserved for future authz checks

  if (isSidecarConfigured()) {
    const resp = await sidecarMutate("/knowledge/source", "DELETE", {
      agentId,
      sourceId,
    });
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        err.error ?? `Sidecar /knowledge/source DELETE returned ${resp.status}`
      );
    }
    return;
  }

  // Local fallback: remove FTS5 chunks then source record
  const db = getDb();
  db.run(sql`DELETE FROM knowledge_chunks WHERE source_id = ${sourceId}`);
  personasRepo.removeKnowledgeSource(db, sourceId);
}

/**
 * Re-index all sources for a persona.
 *
 * - Files and knowledge_dir entries: re-reads from disk
 * - Web sources: re-fetches the URL
 * - Manual/text sources: skipped (no persistent source to re-fetch)
 *
 * @param agentId   Agent workspace identifier
 * @param personaId Target persona
 */
export async function refreshIndex(
  agentId: string,
  personaId: string
): Promise<RefreshResult> {
  const sources = await getSourceList(agentId, personaId);

  let refreshed = 0;
  const failed: string[] = [];

  for (const source of sources) {
    try {
      if (
        source.sourceType === "file" ||
        source.sourceType === "knowledge_dir"
      ) {
        // sourceUri is "file:<relPath>"
        const relPath = source.sourceUri.replace(/^file:/, "");
        await ingestFile(agentId, personaId, relPath, source.sourceType);
        refreshed++;
      } else if (source.sourceType === "web") {
        await ingestUrl(agentId, personaId, source.sourceUri, source.title);
        refreshed++;
      }
      // "manual" sources: no re-fetch target — skip silently
    } catch (err) {
      failed.push(
        `${source.sourceUri}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { refreshed, failed };
}
