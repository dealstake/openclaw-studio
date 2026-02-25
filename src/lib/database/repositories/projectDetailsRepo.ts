import { eq } from "drizzle-orm";
import { projectDetails, projectPlanItems, projectHistory, type ProjectDetailsRow } from "../schema";
import type { StudioDb } from "../index";
import { parseProjectFile, type ProjectDetails } from "@/features/projects/lib/parseProject";

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
  fileMtimeMs?: number,
): ProjectDetails {
  const parsed = parseProjectFile(markdown);
  const now = new Date().toISOString();
  const mtime = fileMtimeMs ?? null;

  // Transactionally upsert details + replace plan items
  db.transaction((tx) => {
    tx.insert(projectDetails)
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
        fileMtimeMs: mtime,
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
          fileMtimeMs: mtime,
          updatedAt: now,
        },
      })
      .run();

    // Delete-all-then-insert pattern for plan items
    tx.delete(projectPlanItems)
      .where(eq(projectPlanItems.doc, doc))
      .run();

    for (const item of parsed.planItems) {
      tx.insert(projectPlanItems)
        .values({
          doc,
          phaseName: item.phaseName,
          taskDescription: item.taskDescription,
          isCompleted: item.isCompleted,
          sortOrder: item.sortOrder,
        })
        .run();
    }

    // Delete-all-then-insert pattern for history entries
    tx.delete(projectHistory)
      .where(eq(projectHistory.doc, doc))
      .run();

    for (const entry of parsed.history) {
      tx.insert(projectHistory)
        .values({
          doc,
          entryDate: entry.entryDate,
          entryText: entry.entryText,
          sortOrder: entry.sortOrder,
        })
        .run();
    }
  });

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

/** Get plan items for a project doc. */
export function getPlanItems(db: StudioDb, doc: string) {
  return db
    .select()
    .from(projectPlanItems)
    .where(eq(projectPlanItems.doc, doc))
    .orderBy(projectPlanItems.sortOrder)
    .all();
}

/** Get history entries for a project doc. */
export function getHistory(db: StudioDb, doc: string) {
  return db
    .select()
    .from(projectHistory)
    .where(eq(projectHistory.doc, doc))
    .orderBy(projectHistory.sortOrder)
    .all();
}

/** Convert a DB row back to the ProjectDetails shape used by the API. */
export function toProjectDetails(
  row: ProjectDetailsRow,
  planItemRows?: { phaseName: string; taskDescription: string; isCompleted: boolean | null; sortOrder: number }[],
  historyRows?: { entryDate: string; entryText: string; sortOrder: number }[],
): ProjectDetails {
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
    planItems: (planItemRows ?? []).map((item) => ({
      phaseName: item.phaseName,
      taskDescription: item.taskDescription,
      isCompleted: item.isCompleted ?? false,
      sortOrder: item.sortOrder,
    })),
    history: (historyRows ?? []).map((entry) => ({
      entryDate: entry.entryDate,
      entryText: entry.entryText,
      sortOrder: entry.sortOrder,
    })),
  };
}
