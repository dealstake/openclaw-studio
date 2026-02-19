import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/database";
import { projectsIndex, tasks, activityEvents, projectDetails } from "@/lib/database/schema";
import { eq, sql } from "drizzle-orm";

describe("database", () => {
  // createTestDb returns a fresh in-memory DB each call — no cleanup needed
  // but we test closeDb works separately

  it("creates a working in-memory database", () => {
    const db = createTestDb();
    expect(db).toBeDefined();
  });

  it("runs migrations and creates projects_index table", () => {
    const db = createTestDb();
    const rows = db.select().from(projectsIndex).all();
    expect(rows).toEqual([]);
  });

  it("creates all 4 data tables via migrations", () => {
    const db = createTestDb();
    const result = db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '%drizzle%' AND name != 'sqlite_sequence' ORDER BY name`
    );
    const tableNames = result.map((r) => r.name).sort();
    expect(tableNames).toEqual(["activity_events", "project_details", "projects_index", "tasks"]);
  });

  it("activity_events table accepts inserts", () => {
    const db = createTestDb();
    db.insert(activityEvents).values({
      id: "test-1",
      timestamp: new Date().toISOString(),
      type: "cron-completion",
      taskName: "Test",
      taskId: "task-1",
      status: "success",
      summary: "Test event",
      metaJson: "{}",
    }).run();
    const rows = db.select().from(activityEvents).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("test-1");
  });

  it("project_details table accepts inserts with FK to projects_index", () => {
    const db = createTestDb();
    const now = new Date().toISOString();
    // Insert parent first
    db.insert(projectsIndex).values({
      name: "Parent", doc: "parent.md", status: "Active", statusEmoji: "🔨",
      priority: "P1", priorityEmoji: "🟡", createdAt: now, updatedAt: now,
    }).run();
    // Insert detail referencing parent doc
    db.insert(projectDetails).values({
      doc: "parent.md",
      lastWorkedOn: now,
      nextStep: "Do something",
      blockedBy: "Nothing",
      contextNeeded: "None",
      progressTotal: 10,
      progressCompleted: 3,
    }).run();
    const details = db.select().from(projectDetails).all();
    expect(details).toHaveLength(1);
    expect(details[0].progressCompleted).toBe(3);
  });

  it("inserts and retrieves a project row", () => {
    const db = createTestDb();
    db.insert(projectsIndex)
      .values({
        name: "Test Project",
        doc: "test-project.md",
        status: "Active",
        statusEmoji: "🔨",
        priority: "P1",
        priorityEmoji: "🟡",
        oneLiner: "A test project",
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();

    const rows = db.select().from(projectsIndex).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Test Project");
    expect(rows[0].doc).toBe("test-project.md");
    expect(rows[0].statusEmoji).toBe("🔨");
  });

  it("enforces unique doc constraint", () => {
    const db = createTestDb();
    const row = {
      name: "P1",
      doc: "same.md",
      status: "Active",
      statusEmoji: "🔨",
      priority: "P1",
      priorityEmoji: "🟡",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.insert(projectsIndex).values(row).run();
    expect(() => db.insert(projectsIndex).values(row).run()).toThrow();
  });

  it("updates a row by doc", () => {
    const db = createTestDb();
    db.insert(projectsIndex)
      .values({
        name: "My Project",
        doc: "my.md",
        status: "Active",
        statusEmoji: "🔨",
        priority: "P1",
        priorityEmoji: "🟡",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();

    db.update(projectsIndex)
      .set({ status: "Done", statusEmoji: "✅", updatedAt: new Date().toISOString() })
      .where(eq(projectsIndex.doc, "my.md"))
      .run();

    const row = db
      .select()
      .from(projectsIndex)
      .where(eq(projectsIndex.doc, "my.md"))
      .get();
    expect(row?.status).toBe("Done");
    expect(row?.statusEmoji).toBe("✅");
  });

  it("deletes a row by doc", () => {
    const db = createTestDb();
    db.insert(projectsIndex)
      .values({
        name: "Delete Me",
        doc: "delete.md",
        status: "Active",
        statusEmoji: "🔨",
        priority: "P1",
        priorityEmoji: "🟡",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();

    db.delete(projectsIndex).where(eq(projectsIndex.doc, "delete.md")).run();
    const rows = db.select().from(projectsIndex).all();
    expect(rows).toHaveLength(0);
  });

  it("orders by sortOrder", () => {
    const db = createTestDb();
    const now = new Date().toISOString();
    db.insert(projectsIndex)
      .values([
        { name: "Third", doc: "c.md", status: "Active", statusEmoji: "🔨", priority: "P2", priorityEmoji: "🟢", sortOrder: 3, createdAt: now, updatedAt: now },
        { name: "First", doc: "a.md", status: "Active", statusEmoji: "🔨", priority: "P0", priorityEmoji: "🔴", sortOrder: 1, createdAt: now, updatedAt: now },
        { name: "Second", doc: "b.md", status: "Active", statusEmoji: "🔨", priority: "P1", priorityEmoji: "🟡", sortOrder: 2, createdAt: now, updatedAt: now },
      ])
      .run();

    const rows = db
      .select()
      .from(projectsIndex)
      .orderBy(projectsIndex.sortOrder)
      .all();
    expect(rows.map((r) => r.name)).toEqual(["First", "Second", "Third"]);
  });
});
