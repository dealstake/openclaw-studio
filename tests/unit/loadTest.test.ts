import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/lib/database";
import type { StudioDb } from "@/lib/database";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import * as activityRepo from "@/lib/database/repositories/activityRepo";

const PROJECTS_COUNT = 500;
const ACTIVITY_COUNT = 10_000;
const MAX_QUERY_MS = 50;

describe("load test", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  it(`inserts ${PROJECTS_COUNT} projects and queries all in <${MAX_QUERY_MS}ms`, () => {
    // Insert 500 projects
    const statuses = ["🔨 Active", "🚧 In Progress", "✅ Done", "⏸️ Parked", "📋 Defined"];
    const priorities = ["🔴 P0", "🟡 P1", "🟢 P2"];

    for (let i = 0; i < PROJECTS_COUNT; i++) {
      const status = statuses[i % statuses.length];
      const priority = priorities[i % priorities.length];
      projectsRepo.upsert(db, {
        name: `Project ${i}`,
        doc: `project-${i}.md`,
        status,
        statusEmoji: status.charAt(0),
        priority,
        priorityEmoji: priority.charAt(0),
        oneLiner: `One-liner for project ${i} with some description text`,
      });
    }

    // Query all — must be <50ms
    const start = performance.now();
    const rows = projectsRepo.listAll(db);
    const elapsed = performance.now() - start;

    expect(rows).toHaveLength(PROJECTS_COUNT);
    expect(elapsed).toBeLessThan(MAX_QUERY_MS);
  });

  it(`inserts ${ACTIVITY_COUNT} activity events and queries with filters in <${MAX_QUERY_MS}ms`, () => {
    const types = ["cron-completion", "manual", "heartbeat", "error"];
    const statuses = ["success", "error", "partial"];

    // Bulk insert 10K events
    for (let i = 0; i < ACTIVITY_COUNT; i++) {
      activityRepo.insert(db, {
        id: `evt-${i}`,
        timestamp: new Date(Date.now() - i * 60_000).toISOString(),
        type: types[i % types.length],
        taskName: `Task ${i % 20}`,
        taskId: `task-${i % 20}`,
        projectSlug: i % 3 === 0 ? `project-${i % 50}` : null,
        projectName: i % 3 === 0 ? `Project ${i % 50}` : null,
        status: statuses[i % statuses.length] as "success" | "error" | "partial",
        summary: `Summary for event ${i}`,
        meta: { phase: `Phase ${i % 5}`, filesChanged: i % 10, testsCount: 100 + i },
      });
    }

    // Query with filter + pagination — must be <50ms
    const start = performance.now();
    const result = activityRepo.query(db, {
      type: "cron-completion",
      limit: 50,
      offset: 0,
    });
    const elapsed = performance.now() - start;

    expect(result.events.length).toBeLessThanOrEqual(50);
    expect(result.total).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(MAX_QUERY_MS);
  });

  it("queries projects by status filter efficiently", () => {
    for (let i = 0; i < PROJECTS_COUNT; i++) {
      projectsRepo.upsert(db, {
        name: `Project ${i}`,
        doc: `project-${i}.md`,
        status: i % 5 === 0 ? "🔨 Active" : "✅ Done",
        statusEmoji: i % 5 === 0 ? "🔨" : "✅",
        priority: "🟡 P1",
        priorityEmoji: "🟡",
        oneLiner: `Description ${i}`,
      });
    }

    const start = performance.now();
    const all = projectsRepo.listAll(db);
    const active = all.filter((r) => r.status === "🔨 Active");
    const elapsed = performance.now() - start;

    expect(active).toHaveLength(PROJECTS_COUNT / 5);
    expect(elapsed).toBeLessThan(MAX_QUERY_MS);
  });

  it("queries activity with project slug filter efficiently", () => {
    for (let i = 0; i < ACTIVITY_COUNT; i++) {
      activityRepo.insert(db, {
        id: `evt-${i}`,
        timestamp: new Date(Date.now() - i * 60_000).toISOString(),
        type: "cron-completion",
        taskName: "Continuation",
        taskId: "task-cont",
        projectSlug: `project-${i % 50}`,
        projectName: `Project ${i % 50}`,
        status: "success",
        summary: `Summary ${i}`,
        meta: {},
      });
    }

    const start = performance.now();
    const result = activityRepo.query(db, {
      projectSlug: "project-7",
      limit: 100,
      offset: 0,
    });
    const elapsed = performance.now() - start;

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.total).toBe(ACTIVITY_COUNT / 50); // 200
    expect(elapsed).toBeLessThan(MAX_QUERY_MS);
  });
});
