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
});
