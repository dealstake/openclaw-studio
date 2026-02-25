import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/database/schema";
import * as activityRepo from "@/lib/database/repositories/activityRepo";
import type { StudioDb } from "@/lib/database";
import type { ActivityEvent } from "@/features/activity/lib/activityTypes";

function createTestDb(): StudioDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema }) as StudioDb;
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type: "cron-completion",
    taskName: "Test Task",
    taskId: "task-001",
    projectSlug: "test-project",
    projectName: "Test Project",
    status: "success",
    summary: "Did some work",
    meta: { phase: "Phase 1", filesChanged: 5 },
    ...overrides,
  };
}

describe("activityRepo", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("insert + query", () => {
    it("inserts and retrieves an event", () => {
      const event = makeEvent();
      activityRepo.insert(db, event);

      const result = activityRepo.query(db);
      expect(result.total).toBe(1);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].id).toBe(event.id);
      expect(result.events[0].taskName).toBe("Test Task");
      expect(result.events[0].meta).toEqual({ phase: "Phase 1", filesChanged: 5 });
    });

    it("skips duplicate IDs on insert", () => {
      const event = makeEvent({ id: "dup-1" });
      activityRepo.insert(db, event);
      activityRepo.insert(db, { ...event, summary: "Updated" });

      const result = activityRepo.query(db);
      expect(result.total).toBe(1);
      expect(result.events[0].summary).toBe("Did some work"); // original kept
    });
  });

  describe("query filters", () => {
    it("filters by type", () => {
      activityRepo.insert(db, makeEvent({ type: "cron-completion" }));
      activityRepo.insert(db, makeEvent({ type: "cron-error" }));

      const result = activityRepo.query(db, { type: "cron-error" });
      expect(result.total).toBe(1);
      expect(result.events[0].type).toBe("cron-error");
    });

    it("filters by taskId", () => {
      activityRepo.insert(db, makeEvent({ taskId: "task-A" }));
      activityRepo.insert(db, makeEvent({ taskId: "task-B" }));

      const result = activityRepo.query(db, { taskId: "task-A" });
      expect(result.total).toBe(1);
    });

    it("filters by projectSlug", () => {
      activityRepo.insert(db, makeEvent({ projectSlug: "alpha" }));
      activityRepo.insert(db, makeEvent({ projectSlug: "beta" }));

      const result = activityRepo.query(db, { projectSlug: "alpha" });
      expect(result.total).toBe(1);
    });

    it("filters by status", () => {
      activityRepo.insert(db, makeEvent({ status: "success" }));
      activityRepo.insert(db, makeEvent({ status: "error" }));

      const result = activityRepo.query(db, { status: "error" });
      expect(result.total).toBe(1);
    });

    it("combines multiple filters", () => {
      activityRepo.insert(db, makeEvent({ type: "cron-completion", status: "success" }));
      activityRepo.insert(db, makeEvent({ type: "cron-completion", status: "error" }));
      activityRepo.insert(db, makeEvent({ type: "cron-error", status: "error" }));

      const result = activityRepo.query(db, { type: "cron-completion", status: "error" });
      expect(result.total).toBe(1);
    });
  });

  describe("pagination", () => {
    it("respects limit and offset", () => {
      for (let i = 0; i < 10; i++) {
        activityRepo.insert(db, makeEvent({
          timestamp: `2026-02-19T${String(i).padStart(2, "0")}:00:00Z`,
        }));
      }

      const page1 = activityRepo.query(db, { limit: 3, offset: 0 });
      expect(page1.total).toBe(10);
      expect(page1.events).toHaveLength(3);

      const page2 = activityRepo.query(db, { limit: 3, offset: 3 });
      expect(page2.events).toHaveLength(3);
      expect(page2.events[0].id).not.toBe(page1.events[0].id);
    });

    it("orders by timestamp descending", () => {
      activityRepo.insert(db, makeEvent({ id: "old", timestamp: "2026-02-18T00:00:00Z" }));
      activityRepo.insert(db, makeEvent({ id: "new", timestamp: "2026-02-19T00:00:00Z" }));

      const result = activityRepo.query(db);
      expect(result.events[0].id).toBe("new");
      expect(result.events[1].id).toBe("old");
    });
  });

  describe("importFromJsonl", () => {
    it("imports valid JSONL lines", () => {
      const jsonl = [
        JSON.stringify(makeEvent({ id: "evt-1" })),
        JSON.stringify(makeEvent({ id: "evt-2" })),
      ].join("\n");

      const result1 = activityRepo.importFromJsonl(db, jsonl);
      expect(result1.imported).toBe(2);

      const result = activityRepo.query(db);
      expect(result.total).toBe(2);
    });

    it("skips malformed lines", () => {
      const jsonl = [
        JSON.stringify(makeEvent({ id: "evt-good" })),
        "not json",
        "{}",  // missing required fields
        JSON.stringify(makeEvent({ id: "evt-also-good" })),
      ].join("\n");

      const result1 = activityRepo.importFromJsonl(db, jsonl);
      expect(result1.imported).toBe(2);
      expect(result1.skipped).toBe(2);
    });

    it("is idempotent", () => {
      const line = JSON.stringify(makeEvent({ id: "evt-idem" }));
      activityRepo.importFromJsonl(db, line);
      activityRepo.importFromJsonl(db, line);

      const result = activityRepo.query(db);
      expect(result.total).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("handles null projectSlug and projectName", () => {
      activityRepo.insert(db, makeEvent({ projectSlug: null, projectName: null }));

      const result = activityRepo.query(db);
      expect(result.events[0].projectSlug).toBeNull();
      expect(result.events[0].projectName).toBeNull();
    });

    it("handles empty meta", () => {
      activityRepo.insert(db, makeEvent({ meta: {} }));

      const result = activityRepo.query(db);
      expect(result.events[0].meta).toEqual({});
    });

    it("returns empty for no data", () => {
      const result = activityRepo.query(db);
      expect(result.events).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
