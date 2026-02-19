import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/database/schema";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import * as tasksRepo from "@/lib/database/repositories/tasksRepo";
import * as activityRepo from "@/lib/database/repositories/activityRepo";
import type { StudioDb } from "@/lib/database";
import type { StudioTask } from "@/features/tasks/types";
import type { ActivityEvent } from "@/features/activity/lib/activityTypes";

function createTestDb(): StudioDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema }) as StudioDb;
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

// ─── Sample Data ─────────────────────────────────────────────────────────────

const SAMPLE_INDEX_MD = `# Projects Index

| Project | Doc | Status | Priority | One-liner |
|---------|-----|--------|----------|-----------|
| Studio Database Layer | studio-database-layer.md | ✅ Done | 🔴 P0 | Replace flat-file data stores with SQLite |
| AI Elements Adoption | ai-elements-adoption.md | 🔨 Active | 🔴 P0 | Install Vercel AI Elements |
| Skills Manager UI | skills-manager-ui.md | 🔨 Active | 🟢 P2 | Browse and install OpenClaw skills |
| Brain Panel Visual QA | brain-panel-visual-qa.md | ⏸️ Parked | 🟡 P1 | Expand modal loses selected tab |
`;

function makeSampleTask(id: string, overrides: Partial<StudioTask> = {}): StudioTask {
  return {
    id,
    cronJobId: `cron-${id}`,
    agentId: "alex",
    name: `Task ${id}`,
    description: `Description for ${id}`,
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 300_000 },
    prompt: "Do the thing",
    model: "anthropic/claude-opus-4-6",
    deliveryChannel: null,
    deliveryTarget: null,
    enabled: true,
    createdAt: "2026-02-19T00:00:00Z",
    updatedAt: "2026-02-19T00:00:00Z",
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    ...overrides,
  };
}

function makeSampleEvent(id: string, overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id,
    timestamp: "2026-02-19T12:00:00Z",
    type: "cron-completion",
    taskName: "Test Task",
    taskId: "task-001",
    projectSlug: "test-project",
    projectName: "Test Project",
    status: "success",
    summary: "Did some work",
    meta: { phase: "Phase 1", filesChanged: 3 },
    ...overrides,
  };
}

// ─── Projects Round-Trip ─────────────────────────────────────────────────────

describe("projects round-trip", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  it("imports INDEX.md and lists all projects with correct count", () => {
    projectsRepo.importFromMarkdown(db, SAMPLE_INDEX_MD);
    const rows = projectsRepo.listAll(db);
    expect(rows).toHaveLength(4);
  });

  it("preserves status emoji and status text after import", () => {
    projectsRepo.importFromMarkdown(db, SAMPLE_INDEX_MD);
    const rows = projectsRepo.listAll(db);
    const done = rows.find((r) => r.doc === "studio-database-layer.md");
    expect(done?.statusEmoji).toBe("✅");
    expect(done?.status).toBe("✅ Done");

    const active = rows.find((r) => r.doc === "ai-elements-adoption.md");
    expect(active?.statusEmoji).toBe("🔨");
    expect(active?.status).toBe("🔨 Active");
  });

  it("preserves priority emoji and text", () => {
    projectsRepo.importFromMarkdown(db, SAMPLE_INDEX_MD);
    const rows = projectsRepo.listAll(db);
    const p0 = rows.find((r) => r.doc === "studio-database-layer.md");
    expect(p0?.priorityEmoji).toBe("🔴");
    expect(p0?.priority).toBe("🔴 P0");

    const p2 = rows.find((r) => r.doc === "skills-manager-ui.md");
    expect(p2?.priorityEmoji).toBe("🟢");
    expect(p2?.priority).toBe("🟢 P2");
  });

  it("updateStatus changes status and round-trips correctly", () => {
    projectsRepo.importFromMarkdown(db, SAMPLE_INDEX_MD);
    const updated = projectsRepo.updateStatus(db, "ai-elements-adoption.md", "🚧 In Progress");
    expect(updated).toBe(true);

    const rows = projectsRepo.listAll(db);
    const project = rows.find((r) => r.doc === "ai-elements-adoption.md");
    expect(project?.status).toBe("🚧 In Progress");
    expect(project?.statusEmoji).toBe("🚧");
  });

  it("remove decreases count by 1", () => {
    projectsRepo.importFromMarkdown(db, SAMPLE_INDEX_MD);
    expect(projectsRepo.listAll(db)).toHaveLength(4);

    const removed = projectsRepo.remove(db, "skills-manager-ui.md");
    expect(removed).toBe(true);
    expect(projectsRepo.listAll(db)).toHaveLength(3);
  });

  it("re-import is idempotent (upserts, no duplicates)", () => {
    projectsRepo.importFromMarkdown(db, SAMPLE_INDEX_MD);
    projectsRepo.importFromMarkdown(db, SAMPLE_INDEX_MD);
    expect(projectsRepo.listAll(db)).toHaveLength(4);
  });
});

// ─── Tasks Round-Trip ────────────────────────────────────────────────────────

describe("tasks round-trip", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  it("imports task array and lists by agent", () => {
    const sampleTasks = [makeSampleTask("t1"), makeSampleTask("t2"), makeSampleTask("t3")];
    tasksRepo.importFromArray(db, sampleTasks);
    const result = tasksRepo.listByAgent(db, "alex");
    expect(result).toHaveLength(3);
  });

  it("upsert updates existing task name", () => {
    tasksRepo.upsert(db, makeSampleTask("t1", { name: "Original" }));
    tasksRepo.upsert(db, makeSampleTask("t1", { name: "Updated" }));
    const task = tasksRepo.getById(db, "t1");
    expect(task?.name).toBe("Updated");
    expect(tasksRepo.listByAgent(db, "alex")).toHaveLength(1);
  });

  it("remove decreases count", () => {
    tasksRepo.importFromArray(db, [makeSampleTask("t1"), makeSampleTask("t2")]);
    expect(tasksRepo.listByAgent(db, "alex")).toHaveLength(2);
    tasksRepo.remove(db, "t1");
    expect(tasksRepo.listByAgent(db, "alex")).toHaveLength(1);
  });

  it("preserves schedule JSON round-trip", () => {
    const schedule = { type: "periodic" as const, intervalMs: 600_000 };
    tasksRepo.upsert(db, makeSampleTask("t1", { schedule }));
    const task = tasksRepo.getById(db, "t1");
    expect(task?.schedule).toEqual(schedule);
  });
});

// ─── Activity Round-Trip ─────────────────────────────────────────────────────

describe("activity round-trip", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  it("imports JSONL and queries correct total", () => {
    const jsonl = [
      JSON.stringify(makeSampleEvent("e1")),
      JSON.stringify(makeSampleEvent("e2")),
      JSON.stringify(makeSampleEvent("e3")),
    ].join("\n");
    const count = activityRepo.importFromJsonl(db, jsonl);
    expect(count).toBe(3);
    expect(activityRepo.query(db).total).toBe(3);
  });

  it("skips malformed JSONL lines", () => {
    const jsonl = [
      JSON.stringify(makeSampleEvent("e1")),
      "not valid json",
      "",
      '{"id":"e2"}', // missing required fields
      JSON.stringify(makeSampleEvent("e3")),
    ].join("\n");
    const count = activityRepo.importFromJsonl(db, jsonl);
    expect(count).toBe(2); // only e1 and e3
  });

  it("no duplicate IDs on re-import", () => {
    const jsonl = JSON.stringify(makeSampleEvent("e1"));
    activityRepo.importFromJsonl(db, jsonl);
    activityRepo.importFromJsonl(db, jsonl);

    const dupes = db.all<{ c: number }>(
      sql`SELECT id, COUNT(*) as c FROM activity_events GROUP BY id HAVING c > 1`
    );
    expect(dupes).toHaveLength(0);
  });

  it("returns events in descending timestamp order", () => {
    activityRepo.insert(db, makeSampleEvent("e1", { timestamp: "2026-02-19T10:00:00Z" }));
    activityRepo.insert(db, makeSampleEvent("e2", { timestamp: "2026-02-19T12:00:00Z" }));
    activityRepo.insert(db, makeSampleEvent("e3", { timestamp: "2026-02-19T11:00:00Z" }));

    const result = activityRepo.query(db);
    expect(result.events.map((e) => e.id)).toEqual(["e2", "e3", "e1"]);
  });

  it("filters by type", () => {
    activityRepo.insert(db, makeSampleEvent("e1", { type: "cron-completion" }));
    activityRepo.insert(db, makeSampleEvent("e2", { type: "cron-error" }));
    const result = activityRepo.query(db, { type: "cron-error" });
    expect(result.total).toBe(1);
    expect(result.events[0].id).toBe("e2");
  });

  it("filters by status", () => {
    activityRepo.insert(db, makeSampleEvent("e1", { status: "success" }));
    activityRepo.insert(db, makeSampleEvent("e2", { status: "error" }));
    const result = activityRepo.query(db, { status: "error" });
    expect(result.total).toBe(1);
    expect(result.events[0].id).toBe("e2");
  });

  it("filters by projectSlug", () => {
    activityRepo.insert(db, makeSampleEvent("e1", { projectSlug: "proj-a" }));
    activityRepo.insert(db, makeSampleEvent("e2", { projectSlug: "proj-b" }));
    const result = activityRepo.query(db, { projectSlug: "proj-a" });
    expect(result.total).toBe(1);
    expect(result.events[0].id).toBe("e1");
  });
});

// ─── Cross-Table Consistency ─────────────────────────────────────────────────

describe("cross-table consistency", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  it("activity projectSlug values reference existing projects (or null)", () => {
    projectsRepo.importFromMarkdown(db, SAMPLE_INDEX_MD);
    activityRepo.insert(db, makeSampleEvent("e1", { projectSlug: "studio-database-layer" }));
    activityRepo.insert(db, makeSampleEvent("e2", { projectSlug: null }));

    const result = activityRepo.query(db);
    const slugs = result.events.map((e) => e.projectSlug).filter(Boolean);
    const projects = projectsRepo.listAll(db);
    const projectDocs = projects.map((p) => p.doc.replace(".md", ""));

    for (const slug of slugs) {
      expect(projectDocs).toContain(slug);
    }
  });

  it("activity with unknown projectSlug still inserts (no FK constraint)", () => {
    // Activity references projects by slug but there's no FK — verify it doesn't crash
    activityRepo.insert(db, makeSampleEvent("e1", { projectSlug: "nonexistent-project" }));
    expect(activityRepo.query(db).total).toBe(1);
  });
});
