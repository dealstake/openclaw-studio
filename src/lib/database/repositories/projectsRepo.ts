import { eq, asc, desc, and, sql } from "drizzle-orm";
import { projectsIndex, type ProjectIndexRow as FullProjectIndexRow } from "../schema";
import { STATUS_ORDER } from "@/features/projects/lib/constants";
import type { StudioDb } from "../index";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Subset of schema ProjectIndexRow returned by repo queries. */
export type ProjectIndexRow = Pick<
  FullProjectIndexRow,
  "name" | "doc" | "status" | "statusEmoji" | "priority" | "priorityEmoji" | "oneLiner" | "sortOrder"
>;

// ─── Repository ──────────────────────────────────────────────────────────────

/** List all projects ordered by sort order (status-based). */
export function listAll(db: StudioDb): ProjectIndexRow[] {
  const rows = db
    .select({
      name: projectsIndex.name,
      doc: projectsIndex.doc,
      status: projectsIndex.status,
      statusEmoji: projectsIndex.statusEmoji,
      priority: projectsIndex.priority,
      priorityEmoji: projectsIndex.priorityEmoji,
      oneLiner: projectsIndex.oneLiner,
      sortOrder: projectsIndex.sortOrder,
    })
    .from(projectsIndex)
    .orderBy(
      asc(projectsIndex.sortOrder),
      asc(projectsIndex.priority),
      // Done projects: most recently completed at bottom (ascending updatedAt within Done group)
      asc(projectsIndex.updatedAt),
      asc(projectsIndex.name),
    )
    .all();

  return rows;
}

/** Get a single project by its doc filename. */
export function getByDoc(db: StudioDb, doc: string): ProjectIndexRow | null {
  const row = db
    .select({
      name: projectsIndex.name,
      doc: projectsIndex.doc,
      status: projectsIndex.status,
      statusEmoji: projectsIndex.statusEmoji,
      priority: projectsIndex.priority,
      priorityEmoji: projectsIndex.priorityEmoji,
      oneLiner: projectsIndex.oneLiner,
      sortOrder: projectsIndex.sortOrder,
    })
    .from(projectsIndex)
    .where(eq(projectsIndex.doc, doc))
    .get();

  return row ?? null;
}

/** Insert or update a project row. Uses `doc` as the conflict key. */
export function upsert(db: StudioDb, row: Omit<ProjectIndexRow, "sortOrder">): void {
  const sortOrder = STATUS_ORDER[row.statusEmoji] ?? 99;
  const now = new Date().toISOString();

  db.insert(projectsIndex)
    .values({
      name: row.name,
      doc: row.doc,
      status: row.status,
      statusEmoji: row.statusEmoji,
      priority: row.priority,
      priorityEmoji: row.priorityEmoji,
      oneLiner: row.oneLiner,
      sortOrder,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: projectsIndex.doc,
      set: {
        name: row.name,
        status: row.status,
        statusEmoji: row.statusEmoji,
        priority: row.priority,
        priorityEmoji: row.priorityEmoji,
        oneLiner: row.oneLiner,
        sortOrder,
        version: sql`${projectsIndex.version} + 1`,
        updatedAt: now,
      },
    })
    .run();
}

/**
 * Update a project's status by doc filename.
 * Supports optimistic locking: pass `expectedVersion` to detect concurrent writes.
 * Returns true if found and updated.
 */
export function updateStatus(
  db: StudioDb,
  doc: string,
  newStatus: string,
  expectedVersion?: number,
): boolean {
  const statusEmoji = newStatus.match(/^(🚧|🔨|📋|🌊|⏸️|✅)/)?.[1] ?? "";
  const sortOrder = STATUS_ORDER[statusEmoji] ?? 99;
  const now = new Date().toISOString();

  const conditions = expectedVersion !== undefined
    ? and(eq(projectsIndex.doc, doc), eq(projectsIndex.version, expectedVersion))
    : eq(projectsIndex.doc, doc);

  const result = db
    .update(projectsIndex)
    .set({
      status: newStatus,
      statusEmoji,
      sortOrder,
      version: sql`${projectsIndex.version} + 1`,
      updatedAt: now,
    })
    .where(conditions)
    .run();

  return result.changes > 0;
}

/** Remove a project by doc filename. Returns true if found. */
export function remove(db: StudioDb, doc: string): boolean {
  const result = db
    .delete(projectsIndex)
    .where(eq(projectsIndex.doc, doc))
    .run();

  return result.changes > 0;
}
