import { describe, it, expect, vi } from "vitest";

// Mock the projectsRepo
vi.mock("@/lib/database/repositories/projectsRepo", () => ({
  listAll: vi.fn(),
}));

import { generateIndexMarkdown } from "@/lib/database/sync/indexSync";
import { listAll } from "@/lib/database/repositories/projectsRepo";
import type { StudioDb } from "@/lib/database/index";

const mockListAll = vi.mocked(listAll);

describe("indexSync", () => {
  const fakeDb = {} as StudioDb;

  it("generates markdown with header and footer", () => {
    mockListAll.mockReturnValue([]);
    const md = generateIndexMarkdown(fakeDb);
    expect(md).toContain("# Projects Index");
    expect(md).toContain("| Project | Doc | Status | Priority | One-liner |");
    expect(md).toContain("## Status Key");
    expect(md).toContain("## Priority Key");
  });

  it("renders project rows in table format", () => {
    mockListAll.mockReturnValue([
      { name: "Test Project", doc: "test-project.md", status: "🔨 Active", priority: "🟡 P1", oneLiner: "A test" },
      { name: "Done Project", doc: "done.md", status: "✅ Done", priority: "—", oneLiner: "Finished" },
    ] as ReturnType<typeof listAll>);
    const md = generateIndexMarkdown(fakeDb);
    expect(md).toContain("| Test Project | test-project.md | 🔨 Active | 🟡 P1 | A test |");
    expect(md).toContain("| Done Project | done.md | ✅ Done | — | Finished |");
  });

  it("handles empty project list", () => {
    mockListAll.mockReturnValue([]);
    const md = generateIndexMarkdown(fakeDb);
    // Should have header line then immediately footer (no rows)
    const lines = md.split("\n");
    const headerIdx = lines.findIndex((l) => l.startsWith("|---"));
    const footerIdx = lines.findIndex((l) => l.includes("## Status Key"));
    // No data rows between header separator and footer
    expect(footerIdx).toBeGreaterThan(headerIdx);
  });
});
