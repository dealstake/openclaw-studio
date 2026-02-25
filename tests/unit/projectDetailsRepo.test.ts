import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/lib/database";
import type { StudioDb } from "@/lib/database";
import * as repo from "@/lib/database/repositories/projectDetailsRepo";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";

describe("projectDetailsRepo", () => {
  let db: StudioDb;

  const sampleProject = {
    name: "Test Project",
    doc: "test-project.md",
    status: "🔨 Active",
    statusEmoji: "🔨",
    priority: "🟡 P1",
    priorityEmoji: "🟡",
    oneLiner: "A test project",
  };

  const sampleMarkdown = `# Test Project

## Summary
A test project.

## Continuation Context
- **Last worked on**: 2026-02-19
- **Immediate next step**: Create the FooBar component
- **Blocked by**: Nothing
- **Context needed**: Read architecture.md

## Implementation Plan

### Phase 1: Setup
- [x] Install dependencies
- [x] Create schema
- [ ] Write tests

### Phase 2: Build
- [ ] Create component
- [ ] Integrate into panel

## Associated Tasks

| Task | CronJobId | Auto-Manage |
|------|-----------|-------------|
| Continuation | abc-123 | yes |
`;

  beforeEach(() => {
    db = createTestDb();
    // Insert parent project first (FK constraint)
    projectsRepo.upsert(db, sampleProject);
  });

  it("returns null for non-existent doc", () => {
    expect(repo.getByDoc(db, "nonexistent.md")).toBeNull();
  });

  it("upsertFromMarkdown parses and caches project details", () => {
    const parsed = repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown);

    expect(parsed.continuation.lastWorkedOn).toBe("2026-02-19");
    expect(parsed.continuation.nextStep).toBe("Create the FooBar component");
    expect(parsed.continuation.blockedBy).toBe("Nothing");
    expect(parsed.continuation.contextNeeded).toBe("Read architecture.md");
    expect(parsed.progress).toEqual({ completed: 2, total: 5, percent: 40 });
    expect(parsed.associatedTasks).toHaveLength(1);
    expect(parsed.associatedTasks[0].name).toBe("Continuation");
  });

  it("getByDoc returns cached row after upsert", () => {
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown);
    const row = repo.getByDoc(db, "test-project.md");

    expect(row).not.toBeNull();
    expect(row!.lastWorkedOn).toBe("2026-02-19");
    expect(row!.nextStep).toBe("Create the FooBar component");
    expect(row!.progressCompleted).toBe(2);
    expect(row!.progressTotal).toBe(5);
    expect(row!.progressPercent).toBe(40);
  });

  it("upsertFromMarkdown updates existing row on re-parse", () => {
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown);

    const updatedMarkdown = sampleMarkdown
      .replace("- [ ] Write tests", "- [x] Write tests")
      .replace("Create the FooBar component", "Build Phase 2");

    repo.upsertFromMarkdown(db, "test-project.md", updatedMarkdown);

    const row = repo.getByDoc(db, "test-project.md");
    expect(row!.progressCompleted).toBe(3);
    expect(row!.progressPercent).toBe(60);
    expect(row!.nextStep).toBe("Build Phase 2");
  });

  it("toProjectDetails converts DB row to API shape", () => {
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown);
    const row = repo.getByDoc(db, "test-project.md")!;
    const details = repo.toProjectDetails(row);

    expect(details.continuation.lastWorkedOn).toBe("2026-02-19");
    expect(details.progress.percent).toBe(40);
    expect(details.associatedTasks).toHaveLength(1);
    expect(details.associatedTasks[0].cronJobId).toBe("abc-123");
  });

  it("remove deletes cached details", () => {
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown);
    expect(repo.remove(db, "test-project.md")).toBe(true);
    expect(repo.getByDoc(db, "test-project.md")).toBeNull();
  });

  it("remove returns false for non-existent doc", () => {
    expect(repo.remove(db, "nonexistent.md")).toBe(false);
  });

  it("handles markdown with no continuation context", () => {
    const minimal = "# Project\n\n## Summary\nJust a summary.\n";
    const parsed = repo.upsertFromMarkdown(db, "test-project.md", minimal);

    expect(parsed.continuation.lastWorkedOn).toBeUndefined();
    expect(parsed.progress.total).toBe(0);
    expect(parsed.associatedTasks).toHaveLength(0);

    const row = repo.getByDoc(db, "test-project.md");
    expect(row!.lastWorkedOn).toBeNull();
    expect(row!.progressTotal).toBe(0);
  });

  it("handles markdown with no associated tasks", () => {
    const noTasks = sampleMarkdown.replace(
      /## Associated Tasks[\s\S]*$/,
      "",
    );
    repo.upsertFromMarkdown(db, "test-project.md", noTasks);
    const row = repo.getByDoc(db, "test-project.md");
    expect(row!.associatedTasksJson).toBeNull();

    const details = repo.toProjectDetails(row!);
    expect(details.associatedTasks).toHaveLength(0);
  });

  it("cascade deletes details when parent project is removed", () => {
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown);
    projectsRepo.remove(db, "test-project.md");
    expect(repo.getByDoc(db, "test-project.md")).toBeNull();
  });

  it("stores and retrieves plan items", () => {
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown);
    const items = repo.getPlanItems(db, "test-project.md");

    expect(items.length).toBe(5);
    expect(items[0].phaseName).toBe("Phase 1: Setup");
    expect(items[0].taskDescription).toBe("Install dependencies");
    expect(items[0].isCompleted).toBe(true);
    expect(items[2].taskDescription).toBe("Write tests");
    expect(items[2].isCompleted).toBe(false);
    expect(items[3].phaseName).toBe("Phase 2: Build");
  });

  it("replaces plan items on re-upsert (delete-all-then-insert)", () => {
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown);
    expect(repo.getPlanItems(db, "test-project.md").length).toBe(5);

    const updatedMd = `# Test Project
## Implementation Plan
### Phase 1: Setup
- [x] Only one item now
`;
    repo.upsertFromMarkdown(db, "test-project.md", updatedMd);
    const items = repo.getPlanItems(db, "test-project.md");
    expect(items.length).toBe(1);
    expect(items[0].taskDescription).toBe("Only one item now");
  });

  it("stores and retrieves history entries", () => {
    const mdWithHistory = sampleMarkdown + `
## History
- 2026-02-19: Project created
- 2026-02-20: Phase 1 completed
`;
    repo.upsertFromMarkdown(db, "test-project.md", mdWithHistory);
    const history = repo.getHistory(db, "test-project.md");

    expect(history.length).toBe(2);
    expect(history[0].entryDate).toBe("2026-02-19");
    expect(history[0].entryText).toBe("Project created");
    expect(history[1].entryDate).toBe("2026-02-20");
    expect(history[1].sortOrder).toBe(1);
  });

  it("stores fileMtimeMs when provided", () => {
    const mtime = 1740500000000;
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown, mtime);
    const row = repo.getByDoc(db, "test-project.md");
    expect(row!.fileMtimeMs).toBe(mtime);
  });

  it("stores null fileMtimeMs when not provided", () => {
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown);
    const row = repo.getByDoc(db, "test-project.md");
    expect(row!.fileMtimeMs).toBeNull();
  });

  it("toProjectDetails includes planItems and history when rows provided", () => {
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown + `
## History
- 2026-02-19: Created
`);
    const row = repo.getByDoc(db, "test-project.md")!;
    const planItemRows = repo.getPlanItems(db, "test-project.md");
    const historyRows = repo.getHistory(db, "test-project.md");
    const details = repo.toProjectDetails(row, planItemRows, historyRows);

    expect(details.planItems.length).toBe(5);
    expect(details.planItems[0].phaseName).toBe("Phase 1: Setup");
    expect(details.planItems[0].isCompleted).toBe(true);
    expect(details.history.length).toBe(1);
    expect(details.history[0].entryDate).toBe("2026-02-19");
    expect(details.history[0].entryText).toBe("Created");
  });

  it("toProjectDetails returns empty planItems/history when no rows provided", () => {
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown);
    const row = repo.getByDoc(db, "test-project.md")!;
    const details = repo.toProjectDetails(row);

    expect(details.planItems).toEqual([]);
    expect(details.history).toEqual([]);
  });

  it("mtime-based invalidation: updated mtime triggers re-parse", () => {
    const mtime1 = 1740500000000;
    repo.upsertFromMarkdown(db, "test-project.md", sampleMarkdown, mtime1);
    const row1 = repo.getByDoc(db, "test-project.md")!;
    expect(row1.fileMtimeMs).toBe(mtime1);
    expect(row1.progressCompleted).toBe(2);

    // Simulate file change: new content with new mtime
    const mtime2 = 1740500060000;
    const updatedMd = sampleMarkdown.replace("- [ ] Write tests", "- [x] Write tests");
    repo.upsertFromMarkdown(db, "test-project.md", updatedMd, mtime2);
    const row2 = repo.getByDoc(db, "test-project.md")!;
    expect(row2.fileMtimeMs).toBe(mtime2);
    expect(row2.progressCompleted).toBe(3);
  });
});
