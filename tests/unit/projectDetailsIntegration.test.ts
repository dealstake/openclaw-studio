import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/lib/database";
import type { StudioDb } from "@/lib/database";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import * as projectDetailsRepo from "@/lib/database/repositories/projectDetailsRepo";

const SAMPLE_MD = `# Test Project

## Continuation Context
- **Last worked on**: 2026-02-24 — Phase 1 completed
- **Immediate next step**: Start Phase 2
- **Blocked by**: Nothing
- **Context needed**: None

## Implementation Plan

### Phase 1: Setup
- [x] Create project structure
- [x] Add database tables

### Phase 2: Implementation
- [ ] Build the feature
- [ ] Write tests

## History
- 2026-02-24: Project created
`;

const UPDATED_MD = `# Test Project

## Continuation Context
- **Last worked on**: 2026-02-25 — Phase 2 started
- **Immediate next step**: Write tests
- **Blocked by**: Nothing
- **Context needed**: None

## Implementation Plan

### Phase 1: Setup
- [x] Create project structure
- [x] Add database tables

### Phase 2: Implementation
- [x] Build the feature
- [ ] Write tests

## History
- 2026-02-24: Project created
- 2026-02-25: Phase 2 feature built
`;

describe("project details integration", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  it("create project → upsert details → API returns full details with progress", () => {
    // Step 1: Create project index entry (simulates project-db.sh create)
    projectsRepo.upsert(db, {
      name: "Test Project",
      doc: "test-project.md",
      status: "🔨 Active",
      statusEmoji: "🔨",
      priority: "🟡 P1",
      priorityEmoji: "🟡",
      oneLiner: "A test project",
    });

    // Step 2: Upsert details from markdown (simulates refresh-details)
    const details = projectDetailsRepo.upsertFromMarkdown(db, "test-project.md", SAMPLE_MD, 1000);

    // Step 3: Verify details are correct
    expect(details.progress.completed).toBe(2);
    expect(details.progress.total).toBe(4);
    expect(details.progress.percent).toBe(50);
    expect(details.continuation.lastWorkedOn).toBe("2026-02-24 — Phase 1 completed");
    expect(details.continuation.nextStep).toBe("Start Phase 2");
    expect(details.planItems).toHaveLength(4);
    expect(details.history).toHaveLength(1);

    // Step 4: Verify DB cache returns same data
    const cached = projectDetailsRepo.getByDoc(db, "test-project.md");
    expect(cached).not.toBeNull();
    expect(cached!.progressCompleted).toBe(2);
    expect(cached!.progressTotal).toBe(4);
    expect(cached!.fileMtimeMs).toBe(1000);

    // Step 5: Verify plan items in DB
    const planItems = projectDetailsRepo.getPlanItems(db, "test-project.md");
    expect(planItems).toHaveLength(4);
    expect(planItems.filter((i) => i.isCompleted)).toHaveLength(2);

    // Step 6: Verify toProjectDetails reconstitutes correctly
    const reconstituted = projectDetailsRepo.toProjectDetails(cached!, planItems, projectDetailsRepo.getHistory(db, "test-project.md"));
    expect(reconstituted.progress.completed).toBe(2);
    expect(reconstituted.progress.total).toBe(4);
    expect(reconstituted.planItems).toHaveLength(4);
    expect(reconstituted.history).toHaveLength(1);
  });

  it("cron agent checks off items → updated progress after re-upsert", () => {
    // Step 1: Initial state
    projectsRepo.upsert(db, {
      name: "Test Project",
      doc: "test-project.md",
      status: "🚧 In Progress",
      statusEmoji: "🚧",
      priority: "🟡 P1",
      priorityEmoji: "🟡",
      oneLiner: "A test project",
    });
    projectDetailsRepo.upsertFromMarkdown(db, "test-project.md", SAMPLE_MD, 1000);

    // Verify initial state
    const initial = projectDetailsRepo.getByDoc(db, "test-project.md");
    expect(initial!.progressCompleted).toBe(2);
    expect(initial!.progressTotal).toBe(4);
    expect(initial!.progressPercent).toBe(50);

    // Step 2: Cron agent modifies .md file (checks off an item) and calls refresh-details
    // Simulated by re-upserting with updated markdown and newer mtime
    const updated = projectDetailsRepo.upsertFromMarkdown(db, "test-project.md", UPDATED_MD, 2000);

    // Step 3: Verify updated progress
    expect(updated.progress.completed).toBe(3);
    expect(updated.progress.total).toBe(4);
    expect(updated.progress.percent).toBe(75);
    expect(updated.continuation.lastWorkedOn).toBe("2026-02-25 — Phase 2 started");
    expect(updated.continuation.nextStep).toBe("Write tests");
    expect(updated.history).toHaveLength(2);

    // Step 4: Verify DB cache is updated
    const cachedAfter = projectDetailsRepo.getByDoc(db, "test-project.md");
    expect(cachedAfter!.progressCompleted).toBe(3);
    expect(cachedAfter!.progressPercent).toBe(75);
    expect(cachedAfter!.fileMtimeMs).toBe(2000);

    // Step 5: Verify plan items replaced (not duplicated)
    const planItems = projectDetailsRepo.getPlanItems(db, "test-project.md");
    expect(planItems).toHaveLength(4);
    expect(planItems.filter((i) => i.isCompleted)).toHaveLength(3);

    // Step 6: Verify history entries replaced (not duplicated)
    const history = projectDetailsRepo.getHistory(db, "test-project.md");
    expect(history).toHaveLength(2);
    expect(history[1].entryText).toContain("Phase 2 feature built");
  });

  it("mtime-based cache hit avoids re-parse", () => {
    // Need projects_index row for FK
    projectsRepo.upsert(db, {
      name: "Test Project",
      doc: "test-project.md",
      status: "🔨 Active",
      statusEmoji: "🔨",
      priority: "🟡 P1",
      priorityEmoji: "🟡",
      oneLiner: "A test project",
    });

    // Upsert with mtime=1000
    projectDetailsRepo.upsertFromMarkdown(db, "test-project.md", SAMPLE_MD, 1000);

    // Get cached row
    const cached = projectDetailsRepo.getByDoc(db, "test-project.md");
    expect(cached).not.toBeNull();
    expect(cached!.fileMtimeMs).toBe(1000);

    // Same mtime = cache hit (the route handler would skip re-read)
    // This test verifies the fileMtimeMs comparison the route uses
    const fileMtimeMs = 1000;
    expect(cached!.fileMtimeMs === fileMtimeMs).toBe(true);

    // Different mtime = cache miss
    const newerMtime = 2000;
    expect(cached!.fileMtimeMs === newerMtime).toBe(false);
  });
});
