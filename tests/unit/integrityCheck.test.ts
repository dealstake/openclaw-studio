import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/database";
import { checkIntegrity } from "@/lib/database/sync/integrityCheck";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import * as tasksRepo from "@/lib/database/repositories/tasksRepo";
import * as activityRepo from "@/lib/database/repositories/activityRepo";
import type { StudioTask } from "@/features/tasks/types";

const SAMPLE_INDEX = `| Project | Doc | Status | Priority | One-liner |
|---------|-----|--------|----------|-----------|
| Proj A | proj-a.md | 🔨 Active | 🔴 P0 | Description A |
| Proj B | proj-b.md | ✅ Done | 🟡 P1 | Description B |
`;

function makeTask(id: string): StudioTask {
  return {
    id,
    cronJobId: "",
    agentId: "alex",
    name: `Task ${id}`,
    description: "",
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 300_000 },
    prompt: "",
    model: "",
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

describe("integrityCheck", () => {
  it("reports match when DB counts equal file counts", () => {
    const db = createTestDb();
    projectsRepo.importFromMarkdown(db, SAMPLE_INDEX);
    tasksRepo.importFromArray(db, [makeTask("t1"), makeTask("t2")]);
    activityRepo.importFromJsonl(
      db,
      '{"id":"e1","timestamp":"2026-01-01T00:00:00Z","type":"cron-completion","taskName":"T","taskId":"t1","status":"success","summary":"ok","meta":{}}\n' +
      '{"id":"e2","timestamp":"2026-01-01T00:00:00Z","type":"cron-completion","taskName":"T","taskId":"t1","status":"success","summary":"ok","meta":{}}',
    );

    const report = checkIntegrity(db, { projects: 2, tasks: 2, activity: 2 });
    expect(report.projectsDrift.match).toBe(true);
    expect(report.tasksDrift.match).toBe(true);
    expect(report.activityDrift.match).toBe(true);
  });

  it("detects drift when DB has fewer projects than file", () => {
    const db = createTestDb();
    projectsRepo.importFromMarkdown(db, SAMPLE_INDEX); // 2 projects

    const report = checkIntegrity(db, { projects: 5, tasks: 0, activity: 0 });
    expect(report.projectsDrift.match).toBe(false);
    expect(report.projectsDrift.dbCount).toBe(2);
    expect(report.projectsDrift.fileCount).toBe(5);
  });

  it("detects drift when DB has fewer tasks than file", () => {
    const db = createTestDb();
    tasksRepo.importFromArray(db, [makeTask("t1")]);

    const report = checkIntegrity(db, { projects: 0, tasks: 3, activity: 0 });
    expect(report.tasksDrift.match).toBe(false);
    expect(report.tasksDrift.dbCount).toBe(1);
    expect(report.tasksDrift.fileCount).toBe(3);
  });

  it("activity match allows DB to have more than file (POST inserts)", () => {
    const db = createTestDb();
    activityRepo.importFromJsonl(
      db,
      '{"id":"e1","timestamp":"2026-01-01T00:00:00Z","type":"cron-completion","taskName":"T","taskId":"t1","status":"success","summary":"ok","meta":{}}\n' +
      '{"id":"e2","timestamp":"2026-01-01T00:00:00Z","type":"cron-completion","taskName":"T","taskId":"t1","status":"success","summary":"ok","meta":{}}',
    );

    // File has 1 line, DB has 2 — DB >= file is a match
    const report = checkIntegrity(db, { projects: 0, tasks: 0, activity: 1 });
    expect(report.activityDrift.match).toBe(true);
  });

  it("reports all zeros for empty DB", () => {
    const db = createTestDb();
    const report = checkIntegrity(db, { projects: 0, tasks: 0, activity: 0 });
    expect(report.projectsDrift.dbCount).toBe(0);
    expect(report.tasksDrift.dbCount).toBe(0);
    expect(report.activityDrift.dbCount).toBe(0);
  });
});
