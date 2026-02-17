import { describe, it, expect } from "vitest";
import { parseProjectFile } from "@/features/projects/lib/parseProject";

describe("parseProjectFile", () => {
  it("parses continuation context", () => {
    const md = `# Project
## Continuation Context
- **Last worked on**: 2026-02-17 — Did stuff
- **Immediate next step**: Build the thing
- **Blocked by**: Nothing
- **Context needed**: src/file.ts
`;
    const result = parseProjectFile(md);
    expect(result.continuation.lastWorkedOn).toBe("2026-02-17 — Did stuff");
    expect(result.continuation.nextStep).toBe("Build the thing");
    expect(result.continuation.blockedBy).toBe("Nothing");
    expect(result.continuation.contextNeeded).toBe("src/file.ts");
  });

  it("parses progress checkboxes", () => {
    const md = `# Project
## Implementation Plan
- [x] Phase 1
- [x] Phase 2
- [ ] Phase 3
- [ ] Phase 4
`;
    const result = parseProjectFile(md);
    expect(result.progress.completed).toBe(2);
    expect(result.progress.total).toBe(4);
    expect(result.progress.percent).toBe(50);
  });

  it("parses associated tasks from table", () => {
    const md = `# Project
## Associated Tasks
| Task | Cron Job ID | Auto-manage |
|------|------------|-------------|
| CI Monitor | abc123 | yes |
| Deploy Watch | def456 | no |

## History
`;
    const result = parseProjectFile(md);
    expect(result.associatedTasks).toHaveLength(2);
    expect(result.associatedTasks[0]).toEqual({
      name: "CI Monitor",
      cronJobId: "abc123",
      autoManage: true,
    });
    expect(result.associatedTasks[1]).toEqual({
      name: "Deploy Watch",
      cronJobId: "def456",
      autoManage: false,
    });
  });

  it("returns empty associated tasks when section missing", () => {
    const md = `# Project
## Continuation Context
- **Immediate next step**: Do something
`;
    const result = parseProjectFile(md);
    expect(result.associatedTasks).toEqual([]);
  });

  it("skips header and separator rows in associated tasks", () => {
    const md = `# Project
## Associated Tasks
| Task | Cron Job ID | Auto-manage |
|------|------------|-------------|
| Build Bot | xyz789 | yes |
`;
    const result = parseProjectFile(md);
    expect(result.associatedTasks).toHaveLength(1);
    expect(result.associatedTasks[0].name).toBe("Build Bot");
  });
});
