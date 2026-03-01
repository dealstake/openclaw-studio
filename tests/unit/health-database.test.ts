import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/database";
import { sql } from "drizzle-orm";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import * as tasksRepo from "@/lib/database/repositories/tasksRepo";
import * as activityRepo from "@/lib/database/repositories/activityRepo";
import { projectDetails } from "@/lib/database/schema";
import type { StudioTask } from "@/features/tasks/types";

/**
 * Tests for the database health check logic.
 * We test the underlying checks (table existence, counts, migration status)
 * rather than the HTTP route to keep tests fast and dependency-free.
 */

const DATA_TABLES = ["projects_index", "tasks", "activity_events", "project_details"] as const;

function makeTask(id: string): StudioTask {
  return {
    id,
    cronJobId: `cron-${id}`,
    agentId: "alex",
    managementStatus: "managed",
    name: `Task ${id}`,
    description: "",
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 300_000 },
    prompt: "",
    model: "",
    thinking: null,
    deliveryChannel: null,
    deliveryTarget: null,
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
  };
}

function getTableNames(db: ReturnType<typeof createTestDb>): string[] {
  return db
    .all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '%drizzle%' AND name != 'sqlite_sequence' ORDER BY name`,
    )
    .map((r) => r.name);
}

function getTableCount(db: ReturnType<typeof createTestDb>, table: string): number {
  const result = db.all<{ c: number }>(sql.raw(`SELECT COUNT(*) as c FROM ${table}`));
  return result[0]?.c ?? 0;
}

function getMigrationCount(db: ReturnType<typeof createTestDb>): number {
  return db.all<{ id: number }>(sql`SELECT id FROM __drizzle_migrations`).length;
}

describe("health-database", () => {
  describe("table existence (ok status)", () => {
    it("all 4 data tables exist after migrations", () => {
      const db = createTestDb();
      const tables = getTableNames(db);
      for (const t of DATA_TABLES) {
        expect(tables).toContain(t);
      }
    });

    it("__drizzle_migrations table exists", () => {
      const db = createTestDb();
      const allTables = db
        .all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type='table'`)
        .map((r) => r.name);
      expect(allTables).toContain("__drizzle_migrations");
    });
  });

  describe("migration tracking", () => {
    it("all 14 migrations applied on fresh DB", () => {
      const db = createTestDb();
      const count = getMigrationCount(db);
      expect(count).toBe(14);
    });
  });

  describe("row counts (degraded status)", () => {
    it("fresh DB has 0 rows in all data tables", () => {
      const db = createTestDb();
      for (const t of DATA_TABLES) {
        expect(getTableCount(db, t)).toBe(0);
      }
    });

    it("populated DB has non-zero rows", () => {
      const db = createTestDb();
      projectsRepo.upsert(db, { name: "Test", doc: "test.md", status: "🔨 Active", statusEmoji: "🔨", priority: "🔴 P0", priorityEmoji: "🔴", oneLiner: "A test" });
      tasksRepo.importFromArray(db, [makeTask("t1")]);
      activityRepo.insert(db, {
        id: "e1",
        timestamp: "2026-01-01T00:00:00Z",
        type: "cron-completion",
        taskName: "T",
        taskId: "t1",
        projectSlug: null,
        projectName: null,
        status: "success",
        summary: "ok",
        meta: {},
      });
      db.insert(projectDetails)
        .values({
          doc: "test.md",
          lastWorkedOn: "2026-01-01",
          nextStep: "Next",
          blockedBy: "Nothing",
          contextNeeded: "None",
          progressTotal: 5,
          progressCompleted: 2,
        })
        .run();

      expect(getTableCount(db, "projects_index")).toBe(1);
      expect(getTableCount(db, "tasks")).toBe(1);
      expect(getTableCount(db, "activity_events")).toBe(1);
      expect(getTableCount(db, "project_details")).toBe(1);
    });
  });

  describe("status determination", () => {
    it("empty DB = degraded (tables exist but no data)", () => {
      const db = createTestDb();
      const allExist = DATA_TABLES.every((t) => getTableNames(db).includes(t));
      const allHaveData = DATA_TABLES.every((t) => getTableCount(db, t) > 0);
      expect(allExist).toBe(true);
      expect(allHaveData).toBe(false);
      // status would be "degraded"
    });

    it("fully populated DB = ok", () => {
      const db = createTestDb();
      projectsRepo.upsert(db, { name: "Test", doc: "test.md", status: "🔨 Active", statusEmoji: "🔨", priority: "🔴 P0", priorityEmoji: "🔴", oneLiner: "A test" });
      tasksRepo.importFromArray(db, [makeTask("t1")]);
      activityRepo.insert(db, {
        id: "e1",
        timestamp: "2026-01-01T00:00:00Z",
        type: "cron-completion",
        taskName: "T",
        taskId: "t1",
        projectSlug: null,
        projectName: null,
        status: "success",
        summary: "ok",
        meta: {},
      });
      db.insert(projectDetails)
        .values({
          doc: "test.md",
          lastWorkedOn: "2026-01-01",
          nextStep: "Next",
          blockedBy: "Nothing",
          contextNeeded: "None",
          progressTotal: 5,
          progressCompleted: 2,
        })
        .run();

      const allExist = DATA_TABLES.every((t) => getTableNames(db).includes(t));
      const allHaveData = DATA_TABLES.every((t) => getTableCount(db, t) > 0);
      expect(allExist).toBe(true);
      expect(allHaveData).toBe(true);
      // status would be "ok"
    });
  });
});
