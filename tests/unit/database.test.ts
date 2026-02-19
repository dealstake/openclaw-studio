import { describe, it, expect, afterEach } from "vitest";
import { createTestDb } from "@/lib/database";
import { projectsIndex } from "@/lib/database/schema";
import { eq } from "drizzle-orm";

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
