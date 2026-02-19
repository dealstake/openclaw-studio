import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/lib/database";
import type { StudioDb } from "@/lib/database";
import * as repo from "@/lib/database/repositories/projectsRepo";
import { generateIndexMarkdown } from "@/lib/database/sync/indexSync";

describe("projectsRepo", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  const sampleRow = {
    name: "Test Project",
    doc: "test-project.md",
    status: "🔨 Active",
    statusEmoji: "🔨",
    priority: "🟡 P1",
    priorityEmoji: "🟡",
    oneLiner: "A test project",
  };

  describe("upsert", () => {
    it("inserts a new row", () => {
      repo.upsert(db, sampleRow);
      const rows = repo.listAll(db);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Test Project");
      expect(rows[0].doc).toBe("test-project.md");
      expect(rows[0].sortOrder).toBe(1); // 🔨 = 1
    });

    it("updates existing row on conflict", () => {
      repo.upsert(db, sampleRow);
      repo.upsert(db, { ...sampleRow, name: "Renamed Project" });
      const rows = repo.listAll(db);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Renamed Project");
    });
  });

  describe("listAll", () => {
    it("returns empty array when no rows", () => {
      expect(repo.listAll(db)).toEqual([]);
    });

    it("sorts by status order", () => {
      repo.upsert(db, { ...sampleRow, doc: "done.md", status: "✅ Done", statusEmoji: "✅" });
      repo.upsert(db, { ...sampleRow, doc: "active.md", status: "🔨 Active", statusEmoji: "🔨" });
      repo.upsert(db, { ...sampleRow, doc: "building.md", status: "🚧 In Progress", statusEmoji: "🚧" });

      const rows = repo.listAll(db);
      expect(rows.map((r) => r.statusEmoji)).toEqual(["🚧", "🔨", "✅"]);
    });
  });

  describe("getByDoc", () => {
    it("returns null for missing doc", () => {
      expect(repo.getByDoc(db, "nope.md")).toBeNull();
    });

    it("returns the matching row", () => {
      repo.upsert(db, sampleRow);
      const row = repo.getByDoc(db, "test-project.md");
      expect(row).not.toBeNull();
      expect(row!.name).toBe("Test Project");
    });
  });

  describe("updateStatus", () => {
    it("returns false for missing doc", () => {
      expect(repo.updateStatus(db, "nope.md", "✅ Done")).toBe(false);
    });

    it("updates status and sort order", () => {
      repo.upsert(db, sampleRow);
      const found = repo.updateStatus(db, "test-project.md", "✅ Done");
      expect(found).toBe(true);

      const row = repo.getByDoc(db, "test-project.md");
      expect(row!.status).toBe("✅ Done");
      expect(row!.statusEmoji).toBe("✅");
      expect(row!.sortOrder).toBe(5);
    });
  });

  describe("remove", () => {
    it("returns false for missing doc", () => {
      expect(repo.remove(db, "nope.md")).toBe(false);
    });

    it("deletes the row", () => {
      repo.upsert(db, sampleRow);
      expect(repo.remove(db, "test-project.md")).toBe(true);
      expect(repo.listAll(db)).toHaveLength(0);
    });
  });

  describe("importFromMarkdown", () => {
    it("imports rows from INDEX.md format", () => {
      const markdown = `# Projects Index

| Project | Doc | Status | Priority | One-liner |
|---------|-----|--------|----------|-----------|
| Alpha | alpha.md | 🔨 Active | 🟡 P1 | First project |
| Beta | beta.md | ✅ Done | 🟢 P2 | Second project |
| Gamma | gamma.md | 🚧 In Progress | 🔴 P0 | Third project |
`;
      repo.importFromMarkdown(db, markdown);
      const rows = repo.listAll(db);
      expect(rows).toHaveLength(3);
      // Sorted: 🚧 (0), 🔨 (1), ✅ (5)
      expect(rows[0].doc).toBe("gamma.md");
      expect(rows[1].doc).toBe("alpha.md");
      expect(rows[2].doc).toBe("beta.md");
    });

    it("is idempotent — re-import updates, does not duplicate", () => {
      const markdown = `| Project | Doc | Status | Priority | One-liner |
|---------|-----|--------|----------|-----------|
| Alpha | alpha.md | 🔨 Active | 🟡 P1 | First |`;
      repo.importFromMarkdown(db, markdown);
      repo.importFromMarkdown(db, markdown);
      expect(repo.listAll(db)).toHaveLength(1);
    });
  });
});

describe("indexSync", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  it("generates valid INDEX.md from DB rows", () => {
    repo.upsert(db, {
      name: "Alpha",
      doc: "alpha.md",
      status: "🔨 Active",
      statusEmoji: "🔨",
      priority: "🟡 P1",
      priorityEmoji: "🟡",
      oneLiner: "First project",
    });

    const md = generateIndexMarkdown(db);
    expect(md).toContain("| Alpha | alpha.md | 🔨 Active | 🟡 P1 | First project |");
    expect(md).toContain("## Status Key");
    expect(md).toContain("## Priority Key");
  });

  it("generates empty table when DB is empty", () => {
    const md = generateIndexMarkdown(db);
    expect(md).toContain("| Project | Doc | Status | Priority | One-liner |");
    expect(md).toContain("## Status Key");
  });
});
