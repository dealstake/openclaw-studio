import { sql } from "drizzle-orm";
import type { StudioDb } from "../index";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DriftReport {
  dbCount: number;
  fileCount: number;
  match: boolean;
}

export interface IntegrityReport {
  projectsDrift: DriftReport;
  tasksDrift: DriftReport;
  activityDrift: DriftReport;
}

// ─── Integrity Check ─────────────────────────────────────────────────────────

/**
 * Compare DB row counts against file-based source counts.
 * Detects drift between DB and backing files.
 */
export function checkIntegrity(
  db: StudioDb,
  fileCounts: { tasks: number; activity: number },
): IntegrityReport {
  const projectsDb = getTableCount(db, "projects_index");
  const tasksDb = getTableCount(db, "tasks");
  const activityDb = getTableCount(db, "activity_events");

  return {
    projectsDrift: {
      dbCount: projectsDb,
      fileCount: projectsDb, // DB is sole SoT — no file to compare
      match: true,
    },
    tasksDrift: {
      dbCount: tasksDb,
      fileCount: fileCounts.tasks,
      match: tasksDb === fileCounts.tasks,
    },
    activityDrift: {
      dbCount: activityDb,
      fileCount: fileCounts.activity,
      match: activityDb >= fileCounts.activity, // DB may have more (POST inserts)
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALLOWED_TABLES = new Set([
  "projects_index",
  "tasks",
  "activity_events",
  "project_details",
]);

function getTableCount(db: StudioDb, tableName: string): number {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`[integrityCheck] Table name not in allowlist: ${tableName}`);
  }
  try {
    const result = db.all<{ count: number }>(
      sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`),
    );
    return result[0]?.count ?? 0;
  } catch {
    return -1; // table doesn't exist
  }
}
