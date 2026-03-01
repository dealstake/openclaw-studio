import { eq, and, desc, sql } from "drizzle-orm";
import { agentFileVersions } from "../schema";
import type { StudioDb } from "../index";
import type { AgentFileName } from "@/lib/agents/agentFiles";

// ─── Public types ─────────────────────────────────────────────────────────────

export type BrainVersionFiles = Record<AgentFileName, string>;

export type BrainVersion = {
  id: string;
  agentId: string;
  versionNumber: number;
  label: string;
  description: string;
  files: BrainVersionFiles;
  deployedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToVersion(row: typeof agentFileVersions.$inferSelect): BrainVersion {
  return {
    id: row.id,
    agentId: row.agentId,
    versionNumber: row.versionNumber,
    label: row.label,
    description: row.description,
    files: JSON.parse(row.filesJson) as BrainVersionFiles,
    deployedAt: row.deployedAt ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

/** List all versions for an agent, newest first. Files are omitted for performance. */
export function listByAgent(
  db: StudioDb,
  agentId: string
): Omit<BrainVersion, "files">[] {
  const rows = db
    .select({
      id: agentFileVersions.id,
      agentId: agentFileVersions.agentId,
      versionNumber: agentFileVersions.versionNumber,
      label: agentFileVersions.label,
      description: agentFileVersions.description,
      deployedAt: agentFileVersions.deployedAt,
      isActive: agentFileVersions.isActive,
      createdAt: agentFileVersions.createdAt,
      updatedAt: agentFileVersions.updatedAt,
    })
    .from(agentFileVersions)
    .where(eq(agentFileVersions.agentId, agentId))
    .orderBy(desc(agentFileVersions.versionNumber))
    .all();

  return rows.map((row) => ({
    id: row.id,
    agentId: row.agentId,
    versionNumber: row.versionNumber,
    label: row.label,
    description: row.description,
    deployedAt: row.deployedAt ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/** Get a single version by ID including full file contents. */
export function getById(
  db: StudioDb,
  agentId: string,
  versionId: string
): BrainVersion | null {
  const row = db
    .select()
    .from(agentFileVersions)
    .where(
      and(
        eq(agentFileVersions.id, versionId),
        eq(agentFileVersions.agentId, agentId)
      )
    )
    .get();

  return row ? rowToVersion(row) : null;
}

/** Get the currently active version for an agent. */
export function getActive(
  db: StudioDb,
  agentId: string
): BrainVersion | null {
  const row = db
    .select()
    .from(agentFileVersions)
    .where(
      and(
        eq(agentFileVersions.agentId, agentId),
        eq(agentFileVersions.isActive, true)
      )
    )
    .get();

  return row ? rowToVersion(row) : null;
}

/** Get the next version number for an agent (max + 1, or 1 if no versions). */
export function nextVersionNumber(db: StudioDb, agentId: string): number {
  const result = db
    .select({ maxVersion: sql<number>`MAX(${agentFileVersions.versionNumber})` })
    .from(agentFileVersions)
    .where(eq(agentFileVersions.agentId, agentId))
    .get();

  return (result?.maxVersion ?? 0) + 1;
}

/** Create a new version snapshot. Returns the created version (without files for response efficiency). */
export function create(
  db: StudioDb,
  params: {
    id: string;
    agentId: string;
    label: string;
    description: string;
    files: BrainVersionFiles;
  }
): Omit<BrainVersion, "files"> {
  const now = new Date().toISOString();
  const versionNumber = nextVersionNumber(db, params.agentId);

  db.insert(agentFileVersions)
    .values({
      id: params.id,
      agentId: params.agentId,
      versionNumber,
      label: params.label,
      description: params.description,
      filesJson: JSON.stringify(params.files),
      deployedAt: null,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return {
    id: params.id,
    agentId: params.agentId,
    versionNumber,
    label: params.label,
    description: params.description,
    deployedAt: null,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Mark a version as deployed/active.
 * Clears isActive on all other versions for the agent first,
 * then sets isActive + deployedAt on the target version.
 * Returns the updated version (with files) or null if not found.
 */
export function deploy(
  db: StudioDb,
  agentId: string,
  versionId: string
): BrainVersion | null {
  const now = new Date().toISOString();

  return db.transaction(() => {
    // Clear active flag on all versions for this agent
    db.update(agentFileVersions)
      .set({ isActive: false, updatedAt: now })
      .where(eq(agentFileVersions.agentId, agentId))
      .run();

    // Activate the target version
    const result = db
      .update(agentFileVersions)
      .set({
        isActive: true,
        deployedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(agentFileVersions.id, versionId),
          eq(agentFileVersions.agentId, agentId)
        )
      )
      .run();

    if (result.changes === 0) return null;

    // Fetch and return the updated row
    const row = db
      .select()
      .from(agentFileVersions)
      .where(
        and(
          eq(agentFileVersions.id, versionId),
          eq(agentFileVersions.agentId, agentId)
        )
      )
      .get();

    return row ? rowToVersion(row) : null;
  });
}

/** Update label/description on an existing version. Returns true if found. */
export function update(
  db: StudioDb,
  agentId: string,
  versionId: string,
  patch: { label?: string; description?: string }
): boolean {
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.description !== undefined) set.description = patch.description;

  const result = db
    .update(agentFileVersions)
    .set(set)
    .where(
      and(
        eq(agentFileVersions.id, versionId),
        eq(agentFileVersions.agentId, agentId)
      )
    )
    .run();

  return result.changes > 0;
}

/** Delete a version. Returns true if found. Cannot delete the active version. */
export function remove(
  db: StudioDb,
  agentId: string,
  versionId: string
): { deleted: boolean; reason?: string } {
  // Check if this is the active version
  const row = db
    .select({ isActive: agentFileVersions.isActive })
    .from(agentFileVersions)
    .where(
      and(
        eq(agentFileVersions.id, versionId),
        eq(agentFileVersions.agentId, agentId)
      )
    )
    .get();

  if (!row) return { deleted: false, reason: "not_found" };
  if (row.isActive) return { deleted: false, reason: "active_version" };

  const result = db
    .delete(agentFileVersions)
    .where(
      and(
        eq(agentFileVersions.id, versionId),
        eq(agentFileVersions.agentId, agentId)
      )
    )
    .run();

  return { deleted: result.changes > 0 };
}
