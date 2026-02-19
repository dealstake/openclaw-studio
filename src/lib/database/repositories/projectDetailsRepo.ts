import { eq } from "drizzle-orm";
import { projectDetails } from "../schema";
import type { StudioDb } from "../index";
import { parseProjectFile, type ProjectDetails } from "@/features/projects/lib/parseProject";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProjectDetailsRow {
  doc: string;
  lastWorkedOn: string | null;
  nextStep: string | null;
  blockedBy: string | null;
  contextNeeded: string | null;
  progressCompleted: number;
  progressTotal: number;
  progressPercent: number;
  associatedTasksJson: string | null;
  updatedAt: string;
}

// ─── Repository ──────────────────────────────────────────────────────────────

/** Get cached project details by doc filename. */
export function getByDoc(db: StudioDb, doc: string): ProjectDetailsRow | null {
  const row = db
    .select()
    .from(projectDetails)
    .where(eq(projectDetails.doc, doc))
    .get();

  return row ?? null;
}

/** Parse markdown and upsert project details into the cache. */
export function upsertFromMarkdown(
  db: StudioDb,
  doc: string,
  markdown: string,
): ProjectDetails {
  const parsed = parseProjectFile(markdown);
  const now = new Date().toISOString();

  db.insert(projectDetails)
    .values({
      doc,
      lastWorkedOn: parsed.continuation.lastWorkedOn ?? null,
      nextStep: parsed.continuation.nextStep ?? null,
      blockedBy: parsed.continuation.blockedBy ?? null,
      contextNeeded: parsed.continuation.contextNeeded ?? null,
      progressCompleted: parsed.progress.completed,
      progressTotal: parsed.progress.total,
      progressPercent: parsed.progress.percent,
      associatedTasksJson: parsed.associatedTasks.length > 0
        ? JSON.stringify(parsed.associatedTasks)
        : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: projectDetails.doc,
      set: {
        lastWorkedOn: parsed.continuation.lastWorkedOn ?? null,
        nextStep: parsed.continuation.nextStep ?? null,
        blockedBy: parsed.continuation.blockedBy ?? null,
        contextNeeded: parsed.continuation.contextNeeded ?? null,
        progressCompleted: parsed.progress.completed,
        progressTotal: parsed.progress.total,
        progressPercent: parsed.progress.percent,
        associatedTasksJson: parsed.associatedTasks.length > 0
          ? JSON.stringify(parsed.associatedTasks)
          : null,
        updatedAt: now,
      },
    })
    .run();

  return parsed;
}

/** Remove cached details for a project. */
export function remove(db: StudioDb, doc: string): boolean {
  const result = db
    .delete(projectDetails)
    .where(eq(projectDetails.doc, doc))
    .run();

  return result.changes > 0;
}

/** Convert a DB row back to the ProjectDetails shape used by the API. */
export function toProjectDetails(row: ProjectDetailsRow): ProjectDetails {
  return {
    continuation: {
      lastWorkedOn: row.lastWorkedOn ?? undefined,
      nextStep: row.nextStep ?? undefined,
      blockedBy: row.blockedBy ?? undefined,
      contextNeeded: row.contextNeeded ?? undefined,
    },
    progress: {
      completed: row.progressCompleted,
      total: row.progressTotal,
      percent: row.progressPercent,
    },
    associatedTasks: row.associatedTasksJson
      ? JSON.parse(row.associatedTasksJson)
      : [],
  };
}
