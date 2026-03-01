import { eq, desc, and, like, sql } from "drizzle-orm";
import { sharedArtifacts } from "../schema";
import type { StudioDb } from "../index";
import type { SharedArtifact } from "@/features/shared-artifacts/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToArtifact(
  row: typeof sharedArtifacts.$inferSelect,
): SharedArtifact {
  return {
    id: row.id,
    sourceAgentId: row.sourceAgentId,
    sourceSessionKey: row.sourceSessionKey,
    name: row.name,
    mimeType: row.mimeType as SharedArtifact["mimeType"],
    content: row.content,
    metadataJson: row.metadataJson,
    createdAt: row.createdAt,
  };
}

// ─── Query Parameters ─────────────────────────────────────────────────────────

export interface ListSharedArtifactsParams {
  /** Filter by producing agent ID */
  sourceAgentId?: string | null;
  /** Filter by session key */
  sourceSessionKey?: string | null;
  /** Filter by MIME type */
  mimeType?: string | null;
  /** Substring search on name */
  nameSearch?: string | null;
  limit?: number;
  offset?: number;
}

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * List shared artifacts, newest first.
 * Returns paginated results + total count.
 */
export function list(
  db: StudioDb,
  params: ListSharedArtifactsParams = {},
): { artifacts: SharedArtifact[]; total: number } {
  const {
    sourceAgentId,
    sourceSessionKey,
    mimeType,
    nameSearch,
    limit = 50,
    offset = 0,
  } = params;

  const conditions = [];

  if (sourceAgentId) {
    conditions.push(eq(sharedArtifacts.sourceAgentId, sourceAgentId));
  }
  if (sourceSessionKey) {
    conditions.push(eq(sharedArtifacts.sourceSessionKey, sourceSessionKey));
  }
  if (mimeType) {
    conditions.push(eq(sharedArtifacts.mimeType, mimeType));
  }
  if (nameSearch) {
    conditions.push(like(sharedArtifacts.name, `%${nameSearch}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = db
    .select()
    .from(sharedArtifacts)
    .where(where)
    .orderBy(desc(sharedArtifacts.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countRow = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(sharedArtifacts)
    .where(where)
    .get();

  return {
    artifacts: rows.map(rowToArtifact),
    total: countRow?.count ?? 0,
  };
}

/**
 * Get a single shared artifact by ID.
 * Returns null if not found.
 */
export function getById(
  db: StudioDb,
  id: string,
): SharedArtifact | null {
  const row = db
    .select()
    .from(sharedArtifacts)
    .where(eq(sharedArtifacts.id, id))
    .get();

  return row ? rowToArtifact(row) : null;
}

/**
 * Create a new shared artifact.
 * Returns the created artifact.
 */
export function create(
  db: StudioDb,
  params: {
    id: string;
    sourceAgentId: string;
    sourceSessionKey: string;
    name: string;
    mimeType: string;
    content: string;
    metadataJson: string;
  },
): SharedArtifact {
  const now = new Date().toISOString();

  db.insert(sharedArtifacts)
    .values({
      id: params.id,
      sourceAgentId: params.sourceAgentId,
      sourceSessionKey: params.sourceSessionKey,
      name: params.name.trim(),
      mimeType: params.mimeType,
      content: params.content,
      metadataJson: params.metadataJson,
      createdAt: now,
    })
    .run();

  return {
    id: params.id,
    sourceAgentId: params.sourceAgentId,
    sourceSessionKey: params.sourceSessionKey,
    name: params.name.trim(),
    mimeType: params.mimeType as SharedArtifact["mimeType"],
    content: params.content,
    metadataJson: params.metadataJson,
    createdAt: now,
  };
}

/**
 * Delete a shared artifact by ID.
 * Returns true if the artifact was found and deleted.
 */
export function remove(db: StudioDb, id: string): boolean {
  const result = db
    .delete(sharedArtifacts)
    .where(eq(sharedArtifacts.id, id))
    .run();

  return result.changes > 0;
}
