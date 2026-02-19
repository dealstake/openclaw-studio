import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

import { getDb } from "@/lib/database";
import { checkIntegrity } from "@/lib/database/sync/integrityCheck";
import { resolveWorkspacePath } from "@/lib/workspace/resolve";

export const runtime = "nodejs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TableStatus {
  exists: boolean;
  count: number;
}

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  tables: Record<string, TableStatus>;
  migrations: {
    applied: number;
    available: number;
    pending: number;
  };
  drift: {
    projects: { dbCount: number; fileCount: number; match: boolean };
    tasks: { dbCount: number; fileCount: number; match: boolean };
    activity: { dbCount: number; fileCount: number; match: boolean };
  } | null;
  errors: string[];
}

// ─── Required Tables ─────────────────────────────────────────────────────────

const DATA_TABLES = ["projects_index", "tasks", "activity_events", "project_details"] as const;

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * GET /api/health/database
 *
 * Returns database health status: table existence, row counts,
 * migration status, and drift between DB and backing files.
 */
export async function GET(request: Request) {
  const errors: string[] = [];

  try {
    const db = getDb();

    // ── Table existence & counts ──────────────────────────────────────
    const existingTables = new Set(
      db
        .all<{ name: string }>(
          sql`SELECT name FROM sqlite_master WHERE type='table'`,
        )
        .map((r) => r.name),
    );

    const tables: Record<string, TableStatus> = {};
    for (const table of DATA_TABLES) {
      const exists = existingTables.has(table);
      let count = 0;
      if (exists) {
        try {
          const result = db.all<{ c: number }>(
            sql.raw(`SELECT COUNT(*) as c FROM ${table}`),
          );
          count = result[0]?.c ?? 0;
        } catch {
          errors.push(`Failed to count rows in ${table}`);
        }
      } else {
        errors.push(`Missing table: ${table}`);
      }
      tables[table] = { exists, count };
    }

    // ── Migration status ──────────────────────────────────────────────
    const migrationsFolder = path.join(process.cwd(), "drizzle");
    const available = fs.existsSync(migrationsFolder)
      ? fs.readdirSync(migrationsFolder).filter((f) => f.endsWith(".sql")).length
      : 0;

    let applied = 0;
    try {
      const rows = db.all<{ id: number }>(
        sql`SELECT id FROM __drizzle_migrations`,
      );
      applied = rows.length;
    } catch {
      errors.push("Cannot read __drizzle_migrations table");
    }

    const pending = available - applied;
    if (pending > 0) {
      errors.push(`${pending} pending migration(s)`);
    }

    // ── Drift detection (best-effort) ─────────────────────────────────
    let drift: HealthResponse["drift"] = null;
    try {
      const url = new URL(request.url);
      const agentId = url.searchParams.get("agentId") ?? "alex";

      const fileCounts = getFileCounts(agentId);
      const report = checkIntegrity(db, fileCounts);
      drift = {
        projects: report.projectsDrift,
        tasks: report.tasksDrift,
        activity: report.activityDrift,
      };
    } catch {
      // Drift check is optional — don't fail health on it
    }

    // ── Determine overall status ──────────────────────────────────────
    const allTablesExist = DATA_TABLES.every((t) => tables[t].exists);
    const allHaveData = DATA_TABLES.every((t) => tables[t].count > 0);
    const migrationsComplete = pending === 0;

    let status: HealthResponse["status"];
    if (allTablesExist && migrationsComplete && allHaveData) {
      status = "ok";
    } else if (allTablesExist && migrationsComplete) {
      status = "degraded"; // tables exist but some empty
    } else {
      status = "error";
    }

    return NextResponse.json({
      status,
      tables,
      migrations: { applied, available, pending },
      drift,
      errors,
    } satisfies HealthResponse);
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        tables: {},
        migrations: { applied: 0, available: 0, pending: 0 },
        drift: null,
        errors: [err instanceof Error ? err.message : "Unknown error"],
      } satisfies HealthResponse,
      { status: 500 },
    );
  }
}

// ─── File Count Helpers ──────────────────────────────────────────────────────

function getFileCounts(agentId: string): {
  projects: number;
  tasks: number;
  activity: number;
} {
  let projects = 0;
  let taskCount = 0;
  let activity = 0;

  try {
    const { absolute: indexPath } = resolveWorkspacePath(agentId, "projects/INDEX.md");
    const content = fs.readFileSync(indexPath, "utf-8");
    // Count table data rows (lines starting with | that aren't headers/separators)
    const lines = content.split("\n").filter((l) => l.startsWith("|"));
    // Subtract header + separator rows
    projects = Math.max(0, lines.length - 2);
  } catch { /* file missing */ }

  try {
    const { absolute: tasksPath } = resolveWorkspacePath(agentId, "tasks/tasks.json");
    const content = fs.readFileSync(tasksPath, "utf-8");
    const arr = JSON.parse(content);
    taskCount = Array.isArray(arr) ? arr.length : 0;
  } catch { /* file missing */ }

  try {
    const { absolute: activityPath } = resolveWorkspacePath(agentId, "reports/activity.jsonl");
    const content = fs.readFileSync(activityPath, "utf-8");
    activity = content.split("\n").filter((l) => l.trim()).length;
  } catch { /* file missing */ }

  return { projects, tasks: taskCount, activity };
}
